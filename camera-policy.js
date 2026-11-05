export function cameraControlsEnabled({connected=false,tilt=false}={}){
  return !(connected && tilt);
}
