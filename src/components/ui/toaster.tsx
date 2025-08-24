import { useToast } from "@/hooks/useToast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { CheckCircle, Info, XCircle, Activity } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  const getIcon = (variant?: string) => {
    switch (variant) {
      case "destructive":
        return <XCircle className="h-3 w-3 text-red-400" />
      case "success":
        return <CheckCircle className="h-3 w-3 text-green-400" />
      case "info":
        return <Info className="h-3 w-3 text-cyan-400" />
      default:
        return <Activity className="h-3 w-3 text-green-400" />
    }
  }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const toastVariant = variant || "terminal";
        return (
          <Toast key={id} variant={toastVariant} {...props}>
            <div className="flex gap-2 w-full">
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(toastVariant)}
              </div>
              <div className="flex-1 grid gap-1 min-w-0">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription className="whitespace-pre-wrap break-all overflow-wrap-anywhere">
                    {description}
                  </ToastDescription>
                )}
              </div>
              {action && (
                <div className="flex-shrink-0">
                  {action}
                </div>
              )}
            </div>
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
