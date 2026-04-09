import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    phonePrefix?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, hint, phonePrefix, ...props }, ref) => {
        const variant = error ? 'error' : 'default';

        return (
            <div className="w-full">
                {label && (
                    <label className="block text-label-md text-[var(--color-text-muted) mb-1.5">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {phonePrefix && (
                        <span className="absolute left-0 top-0 h-full bg-background rounded-l-lg px-3 flex items-center text-muted text-body-md border border-r-0 border-border-DEFAULT">
                            +91
                        </span>
                    )}
                    <input
                        className={cn(
                            'w-full px-4 py-3 rounded-lg border border-border-DEFAULT bg-surface text-text focus:outline-none focus:border-kridha-primary focus:shadow-focus-primary dark:bg-surface-dark dark:border-border-dark dark:text-text-dark transition-all duration-normal min-h-touch text-body-md',
                            variant === 'error' && 'border-error focus:shadow-focus-error',
                            phonePrefix && 'border-l-0 rounded-l-none pl-16',
                            className
                        )}
                        ref={ref}
                        {...props}
                    />
                </div>
                {hint && !error && (
                    <p className="text-label-sm text-muted mt-1">{hint}</p>
                )}
                {error && (
                    <p className="text-label-sm text-error mt-1">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export { Input };