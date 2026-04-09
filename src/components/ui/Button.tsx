import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { Slot } from '@radix-ui/react-slot';

const buttonVariants = cva(
    'inline-flex items-center justify-center rounded-btn font-semibold transition-all duration-normal min-h-touch focus-visible:shadow-focus-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed',
    {
        variants: {
            variant: {
                primary: 'bg-kridha-primary text-white hover:bg-kridha-primary-hover shadow-btn-primary',
                outline: 'border-2 border-kridha-primary text-kridha-primary hover:bg-kridha-primary-light',
                ghost: 'text-kridha-primary hover:bg-kridha-primary-ghost',
                danger: 'bg-error text-white hover:bg-error-dark',
                accent: 'bg-kridha-accent text-gray-900 hover:bg-kridha-accent-hover',
            },
            size: {
                sm: 'px-3 py-1.5 text-label-sm rounded-md',
                md: 'px-5 py-2.5 text-label-md rounded-btn',
                lg: 'px-6 py-3.5 text-label-lg rounded-btn',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, loading, disabled, leftIcon, rightIcon, asChild = false, children, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        const isDisabled = disabled || loading;
        const content = (
            <>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}
                {children}
                {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
            </>
        );

        return (
            <Comp
                className={cn(buttonVariants({ variant, size }), className)}
                ref={ref}
                {...(!asChild && { disabled: isDisabled })}
                {...(asChild && isDisabled && {
                    'aria-disabled': true,
                    onClick: (e: React.MouseEvent) => e.preventDefault(),
                })}
                {...props}
            >
                {asChild ? children : content}
            </Comp>
        );
    }
);

Button.displayName = 'Button';

export { Button, buttonVariants };