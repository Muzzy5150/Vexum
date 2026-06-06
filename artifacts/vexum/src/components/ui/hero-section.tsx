import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronRight } from "lucide-react"

interface HeroSectionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode
  subtitle?: { regular: string; gradient: string }
  description?: string
  ctaText?: string
  ctaHref?: string
  showTitleArrow?: boolean
  gridOptions?: {
    angle?: number; cellSize?: number; opacity?: number
    lightLineColor?: string; darkLineColor?: string
  }
}

const RetroGrid = ({ angle = 65, cellSize = 60, opacity = 0.5, lightLineColor = "gray", darkLineColor = "gray" }) => {
  const gridStyles = {
    "--grid-angle": `${angle}deg`,
    "--cell-size": `${cellSize}px`,
    "--opacity": opacity,
    "--light-line": lightLineColor,
    "--dark-line": darkLineColor,
  } as React.CSSProperties
  return (
    <div className="pointer-events-none absolute size-full overflow-hidden [perspective:220px]" style={{ ...gridStyles, opacity }}>
      <div className="absolute inset-0 [mask-image:linear-gradient(to_top,black_0%,black_68%,transparent_100%)] [transform:rotateX(var(--grid-angle))]">
        <div className="animate-grid [background-image:linear-gradient(to_right,var(--dark-line)_1px,transparent_0),linear-gradient(to_bottom,var(--dark-line)_1px,transparent_0)] [background-repeat:repeat] [background-size:var(--cell-size)_var(--cell-size)] [height:300vh] [inset:0%_0px] [margin-left:-200%] [transform-origin:100%_0_0] [width:600vw]" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] to-transparent to-90%" />
    </div>
  )
}

const HeroSection = React.forwardRef<HTMLDivElement, HeroSectionProps>(
  ({ className, title = "Build products for everyone", subtitle = { regular: "Designing your projects faster with ", gradient: "the largest figma UI kit." }, description = "", ctaText = "Browse", ctaHref = "#", showTitleArrow = true, gridOptions, ...props }, ref) => {
    return (
      <div className={cn("relative", className)} ref={ref} {...props}>
        <div className="absolute top-0 z-[0] h-screen w-screen bg-[radial-gradient(ellipse_20%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
        <section className="relative max-w-full mx-auto z-1">
          <RetroGrid {...gridOptions} />
          <div className="max-w-screen-xl z-10 mx-auto px-4 py-28 gap-12 md:px-8">
            <div className="space-y-5 max-w-3xl leading-0 lg:leading-5 mx-auto text-center">
              <h1 className="text-sm text-gray-400 group font-mono mx-auto px-5 py-2 bg-gradient-to-tr from-zinc-300/5 via-gray-400/5 to-transparent border-[2px] border-white/5 rounded-3xl w-fit">
                {title}
                {showTitleArrow && <ChevronRight className="inline w-4 h-4 ml-2 group-hover:translate-x-1 duration-300" />}
              </h1>
              <h2 className="text-4xl tracking-tighter bg-clip-text text-transparent mx-auto md:text-6xl bg-[linear-gradient(180deg,_#FFF_0%,_rgba(255,_255,_255,_0.00)_202.08%)]">
                {subtitle.regular}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                  {subtitle.gradient}
                </span>
              </h2>
              <p className="max-w-2xl mx-auto text-gray-300">{description}</p>
              <div className="items-center justify-center gap-x-3 space-y-3 sm:flex sm:space-y-0">
                <span className="relative inline-block overflow-hidden rounded-full p-[1.5px]">
                  <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                  <div className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-[#0a0a0f] text-xs font-medium backdrop-blur-3xl">
                    <a href={ctaHref} className="inline-flex rounded-full text-center group items-center w-full justify-center bg-gradient-to-tr from-zinc-300/5 via-purple-400/20 to-transparent text-white border-white/10 border-[1px] hover:via-purple-400/30 transition-all sm:w-auto py-4 px-10">
                      {ctaText}
                    </a>
                  </div>
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }
)
HeroSection.displayName = "HeroSection"
export { HeroSection }
