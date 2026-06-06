import React from 'react';
import { cn } from '@/lib/utils';

interface AnimatedGlowingBorderProps {
  children: React.ReactNode;
  className?: string;
}

const AnimatedGlowingBorder = ({ children, className }: AnimatedGlowingBorderProps) => {
  return (
    <div className={cn('relative group w-full', className)}>
      {/* Layer 1 — outer glow */}
      <div className="absolute inset-[-1px] z-0 overflow-hidden rounded-xl blur-[2px]">
        <div className="absolute inset-[-1000%] animate-[spin_8s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#000_0%,#402fb5_5%,#cf30aa_55%,#000_65%,#000_100%)]" />
      </div>

      {/* Layer 2 — mid bloom */}
      <div className="absolute inset-[-0.5px] z-0 overflow-hidden rounded-xl blur-[1.5px]">
        <div className="absolute inset-[-1000%] animate-[spin_8s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,rgba(0,0,0,0)_0%,#18116a_5%,#6e1b60_55%,rgba(0,0,0,0)_65%,rgba(0,0,0,0)_100%)]" />
      </div>

      {/* Layer 3 — bright highlight rim */}
      <div className="absolute inset-0 z-0 overflow-hidden rounded-xl blur-[0.5px]">
        <div className="absolute inset-[-1000%] animate-[spin_8s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,rgba(0,0,0,0)_0%,#a099d8_5%,#dfa2da_55%,rgba(0,0,0,0)_65%,rgba(0,0,0,0)_100%)] brightness-[1.4]" />
      </div>

      {/* Layer 4 — inner tight dark edge */}
      <div className="absolute inset-[1px] z-0 overflow-hidden rounded-xl">
        <div className="absolute inset-[-1000%] animate-[spin_8s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#1c191c_0%,#402fb5_5%,#cf30aa_55%,#1c191c_65%,#1c191c_100%)] brightness-[1.3]" />
      </div>

      {/* Content — sits on top */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default AnimatedGlowingBorder;
