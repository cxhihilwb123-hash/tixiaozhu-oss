import React from 'react'
import { motion } from 'framer-motion'

const Button = ({
  children,
  variant = 'primary',
  size = 'default',
  fullWidth = false,
  disabled = false,
  loading = false,
  onClick,
  className = '',
  ...props
}) => {
  const baseClasses = 'font-semibold transition-all duration-200 ease-out'
  
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'bg-transparent text-primary-700 hover:bg-primary-50 active:bg-primary-100 rounded-button',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 rounded-button',
    success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 rounded-button',
  }
  
  const sizeClasses = {
    small: 'px-4 py-2 text-sm rounded-lg',
    default: 'px-6 py-3.5 text-base rounded-button',
    large: 'px-8 py-4 text-lg rounded-button',
  }
  
  const widthClasses = fullWidth ? 'w-full' : ''
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : ''
  
  return (
    <motion.button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClasses} ${disabledClasses} ${className}`}
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled || loading}
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <motion.span
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <span>处理中...</span>
        </span>
      ) : children}
    </motion.button>
  )
}

export default Button
