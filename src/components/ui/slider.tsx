import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  const isBitmapSlider = className?.includes('bitmap-slider');

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn(
          "relative w-full grow overflow-hidden",
          isBitmapSlider
            ? "h-[6px] rounded-[2px] bg-black/50 border border-cyan-500/30"
            : "h-2 rounded-full bg-secondary"
        )}
      >
        <SliderPrimitive.Range
          className={cn(
            "absolute h-full",
            isBitmapSlider
              ? "bg-gradient-to-r from-green-400 via-yellow-400 via-orange-500 to-red-500 shadow-[0_0_8px_rgba(0,255,65,0.4)] rounded-[2px]"
              : "bg-primary"
          )}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          "block transition-all disabled:pointer-events-none disabled:opacity-50",
          isBitmapSlider
            ? "h-[18px] w-[18px] rounded-[2px] border-2 border-cyan-500 bg-black shadow-[0_0_12px_rgba(34,211,238,0.6),inset_0_0_4px_rgba(34,211,238,0.3)] focus-visible:outline-none focus-visible:shadow-[0_0_24px_rgba(34,211,238,1),inset_0_0_8px_rgba(34,211,238,0.6)] hover:shadow-[0_0_18px_rgba(34,211,238,0.9),inset_0_0_6px_rgba(34,211,238,0.5)] hover:border-cyan-400 active:scale-110 cursor-pointer"
            : "h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
      />
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
