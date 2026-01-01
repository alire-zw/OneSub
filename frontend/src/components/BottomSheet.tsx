'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './BottomSheet.module.css';

interface BottomSheetOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: BottomSheetOption[];
  selectedValue: string | string[];
  onSelect: (value: string) => void;
}

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
}: BottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // مدیریت انیمیشن باز و بسته شدن
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // استفاده از requestAnimationFrame برای اطمینان از render شدن DOM
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      // انتظار برای اتمام انیمیشن قبل از unmount
      const timer = setTimeout(() => setShouldRender(false), 450);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);
  
  // قفل کردن scroll وقتی bottom sheet باز است
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // بستن با کلید Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSelect = (value: string) => {
    onSelect(value);
    onClose();
  };

  if (!shouldRender || typeof window === 'undefined') return null;

  const content = (
    <>
      {/* Backdrop */}
      <div 
        className={`${styles.backdrop} ${isVisible ? styles.backdropVisible : ''}`}
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className={`${styles.bottomSheet} ${isVisible ? styles.bottomSheetVisible : ''}`}>
        
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.handle}></div>
          <h3 className={styles.title}>{title}</h3>
        </div>

        {/* Options */}
        <div className={styles.options}>
          {options.map((option) => {
            const isSelected = Array.isArray(selectedValue) 
              ? selectedValue.includes(option.value)
              : selectedValue === option.value;
            
            // بررسی اینکه آیا آیکون رنگ خاصی دارد (مثل آیکون تلگرام)
            const hasCustomColor = option.icon && 
              typeof option.icon === 'object' && 
              'props' in option.icon && 
              option.icon.props && 
              typeof option.icon.props === 'object' &&
              'color' in option.icon.props &&
              typeof (option.icon.props as { color?: string }).color === 'string';
            
            return (
              <div
                key={option.value}
                className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
                onClick={() => handleSelect(option.value)}
              >
                {option.icon && <span className={styles.optionIcon}>{option.icon}</span>}
                <span 
                  className={styles.optionLabel} 
                  style={isSelected && hasCustomColor ? { color: 'var(--foreground)' } : undefined}
                >
                  {option.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  // استفاده از Portal برای رندر کردن در body و جلوگیری از مشکلات stacking context
  return createPortal(content, document.body);
}

