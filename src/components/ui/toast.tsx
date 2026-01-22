import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-4 left-4 right-4 z-[100] flex max-h-screen w-[calc(100%-2rem)] flex-col-reverse gap-2 sm:left-auto sm:right-4 sm:bottom-20 sm:top-auto sm:w-full sm:max-w-[400px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-sm border p-4 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full font-mono text-xs",
  {
    variants: {
      variant: {
        default: "bg-black border-green-500/30 text-green-400",
        terminal: "bg-black border-green-500/30 text-green-400",
        success: "bg-black border-green-500/30 text-green-400",
        destructive:
          "bg-black border-red-500/30 text-red-400",
        info: "bg-black border-cyan-500/30 text-cyan-400",
      },
    },
    defaultVariants: {
      variant: "terminal",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-6 shrink-0 items-center justify-center rounded-sm border bg-transparent px-2 text-xs font-mono font-medium transition-colors hover:bg-green-500/20 focus:outline-none focus:ring-1 focus:ring-green-500/50 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-red-500/50 group-[.destructive]:text-red-400 group-[.destructive]:hover:bg-red-500/20 group-[.destructive]:focus:ring-red-500/50 group-[.info]:border-cyan-500/50 group-[.info]:text-cyan-400 group-[.info]:hover:bg-cyan-500/20 group-[.info]:focus:ring-cyan-500/50",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-sm p-1 text-green-500/50 opacity-0 transition-opacity hover:text-green-400 hover:bg-green-500/20 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-green-500/50 group-hover:opacity-100 group-[.destructive]:text-red-500/50 group-[.destructive]:hover:text-red-400 group-[.destructive]:hover:bg-red-500/20 group-[.destructive]:focus:ring-red-500/50 group-[.info]:text-cyan-500/50 group-[.info]:hover:text-cyan-400 group-[.info]:hover:bg-cyan-500/20 group-[.info]:focus:ring-cyan-500/50",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3 w-3" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-xs font-semibold font-mono", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs opacity-90 font-mono", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
