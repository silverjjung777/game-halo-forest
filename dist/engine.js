'use strict';
window.ForestRenderer = class {
  constructor(canvas) {
    this.canvas=canvas;const g=this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,premultipliedAlpha:false});
    if(!g)throw Error('WebGL을 사용할 수 없어요. 브라우저의 하드웨어 가속을 확인해 주세요.');
    const compile=(type,src)=>{const s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s;};
    const p=this.program=g.createProgram();
    g.attachShader(p,compile(g.VERTEX_SHADER,'attribute vec2 a_position;attribute vec2 a_uv;attribute vec4 a_color;uniform vec2 u_resolution;uniform float u_scale;uniform vec2 u_offset;varying vec2 v_uv;varying vec4 v_color;void main(){vec2 p=(a_position*u_scale+u_offset)/u_resolution*2.-1.;gl_Position=vec4(p.x,-p.y,0.,1.);v_uv=a_uv;v_color=a_color;}'));
    g.attachShader(p,compile(g.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D u_image;varying vec2 v_uv;varying vec4 v_color;void main(){gl_FragColor=texture2D(u_image,v_uv)*v_color;}'));
    g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error('WebGL 셰이더 오류');g.useProgram(p);
    this.buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.buffer);
    for(const [n,size,off] of [['a_position',2,0],['a_uv',2,8],['a_color',4,16]]){const loc=g.getAttribLocation(p,n);g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,size,g.FLOAT,false,32,off);}
    this.resolution=g.getUniformLocation(p,'u_resolution');this.uScale=g.getUniformLocation(p,'u_scale');this.uOffset=g.getUniformLocation(p,'u_offset');
    g.uniform1i(g.getUniformLocation(p,'u_image'),0);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);this.vertices=[];
  }
  texture(source,smooth=false){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);for(const p of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER])g.texParameteri(g.TEXTURE_2D,p,smooth?g.LINEAR:g.NEAREST);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,source);return {handle:t,w:source.width,h:source.height};}
  begin(cameraX=0){const c=this.canvas,g=this.gl,w=c.clientWidth,h=c.clientHeight,d=Math.min(devicePixelRatio||1,2);if(c.width!==Math.round(w*d)||c.height!==Math.round(h*d)){c.width=Math.round(w*d);c.height=Math.round(h*d);}g.viewport(0,0,c.width,c.height);g.clearColor(.025,.06,.045,1);g.clear(g.COLOR_BUFFER_BIT);this.scale=Math.min(w/1456,h/816);this.offset=[(w-1456*this.scale)/2,(h-816*this.scale)/2];g.uniform2f(this.resolution,w,h);g.uniform1f(this.uScale,this.scale);g.uniform2f(this.uOffset,this.offset[0]-cameraX*this.scale,this.offset[1]);this.vertices.length=0;this.current=null;}
  quad(tex,x,y,w,h,color=[1,1,1,1],frame=null,flip=false,angle=0){if(this.current!==tex){this.flush();this.current=tex;}let u0=frame?frame.x/tex.w:0,v0=frame?frame.y/tex.h:0,u1=frame?(frame.x+frame.w)/tex.w:1,v1=frame?(frame.y+frame.h)/tex.h:1;if(flip)[u0,u1]=[u1,u0];const co=Math.cos(angle),si=Math.sin(angle),cx=x+w/2,cy=y+h/2;const pts=[[-w/2,-h/2,u0,v0],[w/2,-h/2,u1,v0],[-w/2,h/2,u0,v1],[w/2,h/2,u1,v1]];for(const i of [0,1,2,2,1,3]){const p=pts[i];this.vertices.push(cx+p[0]*co-p[1]*si,cy+p[0]*si+p[1]*co,p[2],p[3],...color);}}
  rect(x,y,w,h,color){this.quad(this.art.white,x,y,w,h,color);}
  glow(x,y,size,color){this.quad(this.art.glow,x-size/2,y-size/2,size,size,color);}
  flush(){if(!this.vertices.length)return;const g=this.gl;g.bindTexture(g.TEXTURE_2D,this.current.handle);g.bufferData(g.ARRAY_BUFFER,new Float32Array(this.vertices),g.DYNAMIC_DRAW);g.drawArrays(g.TRIANGLES,0,this.vertices.length/8);this.vertices.length=0;}
};
