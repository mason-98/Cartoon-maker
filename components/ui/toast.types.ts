import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"

export interface ToastProps {
  variant?: "default" | "destructive"
  className?: string
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export type ToastActionElement = React.ReactElement<typeof ToastPrimitives.Action>

export type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
} 