// One consistent *presentation* safe area for every authored 2D controller.
// Do not alter the SVG paths, their original input mapping, or button geometry.
// Some source viewBoxes tightly touch the outer stroke: without padding, the
// visible half of the stroke is clipped by SVG viewport / knockout mask edges.
export const SVG_SAFE_AREA=Object.freeze({horizontal:0.055,vertical:0.035});

export function paddedSvgViewBox(viewBox,margin=SVG_SAFE_AREA){
  if(!Array.isArray(viewBox)||viewBox.length!==4)
    throw new TypeError('Expected SVG viewBox [x, y, width, height]');
  const [x,y,width,height]=viewBox.map(Number);
  if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)
    throw new RangeError('SVG source viewBox must have finite positive dimensions');
  const horizontal=Number(margin.horizontal),vertical=Number(margin.vertical);
  if(![horizontal,vertical].every(n=>Number.isFinite(n)&&n>=0&&n<=.25))
    throw new RangeError('Invalid SVG presentation safe-area margin');
  const mx=width*horizontal,my=height*vertical;
  return [x-mx,y-my,width+2*mx,height+2*my];
}

// Safe to call from multiple viewers; applied exactly once per loaded SVG.
// The controller's authored mapping.viewBox is intentionally NOT changed.
export function ensureSvgSafeArea(svg){
  if(!svg?.getAttribute||!svg?.setAttribute)throw new TypeError('Expected root SVG element');
  const current=(svg.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
  if(current.length!==4)throw new RangeError('Missing original SVG viewBox');
  if(svg.getAttribute('data-exo-padded-viewbox')==='1')return current;
  const padded=paddedSvgViewBox(current);
  svg.setAttribute('viewBox',padded.join(' '));
  svg.setAttribute('data-exo-padded-viewbox','1');
  return padded;
}
