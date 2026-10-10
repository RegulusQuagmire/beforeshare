import { useEffect, useRef } from 'react'

export function AmbientBackdrop({ theme }: { theme: 'dark' | 'light' }) {
  const host=useRef<HTMLDivElement>(null),sky=useRef<SVGSVGElement>(null)
  useEffect(()=>{
    const layer=host.current,svg=sky.current
    if(!layer||!svg) return
    const reduced=matchMedia('(prefers-reduced-motion: reduce)')
    const ns='http://www.w3.org/2000/svg'
    let frame=0,last=0,painted=0
    svg.replaceChildren()
    const lines=Array.from({length:60},()=>{const line=document.createElementNS(ns,'line');svg.append(line);return line})
    const stars=Array.from({length:42},()=>{
      const dot=document.createElementNS(ns,'circle');dot.setAttribute('r',String(1+Math.random()*1.2));svg.append(dot)
      return {dot,x:Math.random()*1000,y:Math.random()*800,vx:(Math.random()-.5)*9,vy:(Math.random()-.5)*9}
    })
    const draw=(elapsed:number)=>{
      for(const star of stars){
        star.x+=star.vx*elapsed;star.y+=star.vy*elapsed
        if(star.x<0||star.x>1000){star.x=Math.max(0,Math.min(1000,star.x));star.vx*=-1}
        if(star.y<0||star.y>800){star.y=Math.max(0,Math.min(800,star.y));star.vy*=-1}
        star.dot.setAttribute('cx',String(star.x));star.dot.setAttribute('cy',String(star.y))
      }
      let count=0
      for(let i=0;i<stars.length;i++)for(let j=i+1;j<stars.length&&count<lines.length;j++){
        const a=stars[i],b=stars[j],distance=Math.hypot(a.x-b.x,a.y-b.y)
        if(distance>180) continue
        const line=lines[count++];line.setAttribute('x1',String(a.x));line.setAttribute('y1',String(a.y));line.setAttribute('x2',String(b.x));line.setAttribute('y2',String(b.y));line.setAttribute('opacity',String((1-distance/180)*.3))
      }
      for(let i=count;i<lines.length;i++)lines[i].setAttribute('opacity','0')
    }
    const tick=(now:number)=>{
      if(now-painted>=40){draw(last?Math.min((now-last)/1000,.1):0);last=now;painted=now}
      frame=requestAnimationFrame(tick)
    }
    const update=()=>{
      cancelAnimationFrame(frame);last=0;painted=0
      const paused=reduced.matches||document.hidden
      layer.dataset.paused=String(paused)
      if(theme==='dark'&&!paused)frame=requestAnimationFrame(tick)
    }
    draw(0);update()
    reduced.addEventListener('change',update);document.addEventListener('visibilitychange',update)
    return ()=>{cancelAnimationFrame(frame);reduced.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);svg.replaceChildren()}
  },[theme])
  return <div ref={host} className={'ambient-background '+theme} aria-hidden="true">
    <svg ref={sky} className="constellations" viewBox="0 0 1000 800" preserveAspectRatio="none"/>
    <div className="gradient-cloud cloud-one"/><div className="gradient-cloud cloud-two"/><div className="gradient-cloud cloud-three"/>
  </div>
}
