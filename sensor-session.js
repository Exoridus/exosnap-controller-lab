// WebHID transport. The Gamepad API remains the sole source for buttons.
// The connection is opt-in (user gesture). Sony and Nintendo are separate
// protocol families; an unknown device never creates synthetic IMU samples.
import {
  identifyMotionProfile, parseDualShock4Motion, parseDualShock4Calibration, normalizeDualShock4,
  parseSwitchMotion, normalizeSwitchMotion, parseSwitchImuCalibration,
  switchSubcommandPacket, parseSwitchSpiReply, applySwitchUserCalibration
} from './sensor-profiles.js';
import {parseDualSenseMotion,parseDualSenseFactoryCalibration,normalizeDualSenseSensorSample} from './motion-input.js';
import {parseSonyHidGamepad} from './sony-hid-gamepad.js';

export class WebHidMotionSession {
  constructor(device,{onSample,onInput=()=>{},onStatus=()=>{},onError=()=>{}}){
    this.device=device;this.profile=identifyMotionProfile(device);
    if(!this.profile)throw Error('Für dieses Gerät ist kein WebHID-Bewegungsadapter verfügbar');
    this.onSample=onSample;this.onInput=onInput;this.onStatus=onStatus;this.onError=onError;
    this.calibration=null;this.lastSampleAt=0;this.closed=false;
    this.spiWaiter=null;this.seq=0;this.bluetooth=false;
    this.reportBound=event=>this.handleInput(event);
  }
  async start(){
    const d=this.device;
    if(!d.opened)await d.open();
    d.oninputreport=this.reportBound;
    if(this.profile.id==='dualsense'){
      try{
        this.calibration=parseDualSenseFactoryCalibration(await d.receiveFeatureReport(0x05));
      }catch(error){this.onStatus('DualSense-Werkskalibrierung nicht abrufbar · SDL-Fallback');}
    }else if(this.profile.id==='ds4'){
      const reports=d.collections?.flatMap(c=>c.inputReports||[]).map(r=>r.reportId)||[];
      this.bluetooth=reports.some(id=>id>=0x11&&id<=0x19)&&!reports.includes(0x01);
      try{
        // Reading 0x02 also enables extended BT input on Sony DS4 firmware.
        const usb=await d.receiveFeatureReport(0x02);
        const data=this.bluetooth?await d.receiveFeatureReport(0x05):usb;
        this.calibration=parseDualShock4Calibration(data,{bluetooth:this.bluetooth});
      }catch(error){this.onStatus('DualShock-4-Werkskalibrierung nicht abrufbar · SDL-Fallback');}
    }else{
      // Nintendo factory IMU values are stored in SPI flash, not a feature report.
      // 0x40 enables IMU and 0x03 selects full sensor report mode 0x30.
      await d.sendReport(0x01,switchSubcommandPacket(0x40,[0x01],this.seq++));
      await d.sendReport(0x01,switchSubcommandPacket(0x03,[0x30],this.seq++));
      try{
        const imu=await this.readSwitchSpi(0x6020,24);
        this.calibration=parseSwitchImuCalibration(new DataView(imu.buffer,imu.byteOffset,imu.byteLength));
        if(this.calibration){
          try{
            const user=await this.readSwitchSpi(0x8026,20);
            this.calibration=applySwitchUserCalibration(this.calibration,
              new DataView(user.buffer,user.byteOffset,user.byteLength));
          }catch(error){/* User calibration is optional; valid factory data remain. */}
        }
      }catch(error){this.onStatus('Nintendo-SPI-Kalibrierung nicht abrufbar · SDL-Fallback');}
    }
    this.onStatus(`${this.profile.name}: ${this.calibration?'Werkskalibrierung':'SDL-Fallback'} · Sensorstream wird erwartet`);
    return this;
  }
  handleInput(event){
    if(this.closed||event.device!==this.device)return;
    const {reportId,data}=event;
    // Read buttons from the SAME HID packet as IMU, so opening the sensor
    // interface cannot leave a stale L3 press in the browser Gamepad API.
    const input=parseSonyHidGamepad(this.profile.id,reportId,data);
    if(input)this.onInput(input,performance.now());
    if(this.spiWaiter&&reportId===0x21){
      const {address,size,resolve}=this.spiWaiter;
      const payload=parseSwitchSpiReply(reportId,data,address,size);
      if(payload){clearTimeout(this.spiWaiter.timeout);this.spiWaiter=null;resolve(payload);}
    }
    let samples;
    if(this.profile.id==='dualsense'){
      const raw=parseDualSenseMotion(reportId,data);
      if(raw){
        const physical=normalizeDualSenseSensorSample(raw,this.calibration);
        if(physical)samples=[{...raw,...physical}];
      }
    }else if(this.profile.id==='ds4'){
      const raw=parseDualShock4Motion(reportId,data);
      if(raw)samples=[normalizeDualShock4(raw,this.calibration)];
    }else{
      const raw=parseSwitchMotion(reportId,data);
      if(raw)samples=raw.map(s=>normalizeSwitchMotion(s,this.calibration,this.profile.id));
    }
    if(!samples?.length)return;
    const now=performance.now();
    for(let i=0;i<samples.length;i++){
      const sample=samples[i];
      if(sample)this.onSample(sample,now-(samples.length-1-i)*5);
    }
    this.lastSampleAt=now;
  }
  async readSwitchSpi(address,size){
    if(this.spiWaiter)throw Error('Concurrent SPI commands are unsupported');
    let waitResolve,waitReject;
    const awaited=new Promise((resolve,reject)=>{waitResolve=resolve;waitReject=reject;});
    const waiter={address,size,resolve:waitResolve,reject:waitReject,timeout:null};
    waiter.timeout=setTimeout(()=>{
      if(this.spiWaiter===waiter){this.spiWaiter=null;waitReject(Error('Nintendo SPI timeout'));}
    },650);
    this.spiWaiter=waiter;
    const bytes=[address&255,(address>>>8)&255,(address>>>16)&255,(address>>>24)&255,size];
    try{await this.device.sendReport(0x01,switchSubcommandPacket(0x10,bytes,this.seq++));}
    catch(error){
      clearTimeout(waiter.timeout);this.spiWaiter=null;
      // Consume the rejected promise as well if sendReport fails before awaited is returned.
      awaited.catch(()=>{});waitReject(error);throw error;
    }
    return awaited;
  }
  async close(){
    if(this.closed)return;
    this.closed=true;
    if(this.spiWaiter){clearTimeout(this.spiWaiter.timeout);this.spiWaiter.reject(Error('Disconnected'));this.spiWaiter=null;}
    this.device.oninputreport=null;
    try{if(this.device.opened)await this.device.close();}catch(error){this.onError(error);}
  }
}
