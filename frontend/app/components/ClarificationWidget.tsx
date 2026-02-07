'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface Widget {
    type: 'radio' | 'checkbox' | 'slider' | 'text' | 'poll' | 'color_picker' | 'select' | 'checkbox_group';
    field: string;
    label: string;
    options?: Array<{ value: string; label: string; icon?: string }>;
    min?: number;
    max?: number;
    min_value?: number;  // Backend naming
    max_value?: number;  // Backend naming
    step?: number;
    placeholder?: string;
    colors?: string[]; // For color picker
    default_value?: any;
}

interface ClarificationWidgetProps {
    message: string;
    widgets: Widget[];
    parsedSoFar?: Record<string, any>;
    onSubmit: (responses: Record<string, any>) => void;
    onSkip?: () => void;
}

// Predefined color palette for fashion - maps color names to hex values
const COLOR_MAP: Record<string, string> = {
    'black': '#000000',
    'white': '#FFFFFF',
    'navy': '#1e3a5f',
    'gray': '#6b7280',
    'grey': '#6b7280',
    'red': '#dc2626',
    'blue': '#2563eb',
    'dark_blue': '#1e3a8a',
    'light_blue': '#60a5fa',
    'green': '#16a34a',
    'pink': '#ec4899',
    'beige': '#d4b896',
    'brown': '#78350f',
    'colorful': 'linear-gradient(135deg, #f97316, #ec4899, #8b5cf6, #06b6d4)',
    'distressed': '#94a3b8',
};

const COLOR_PALETTE = [
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#FFFFFF' },
    { name: 'Navy', value: '#1e3a5f' },
    { name: 'Gray', value: '#6b7280' },
    { name: 'Red', value: '#dc2626' },
    { name: 'Blue', value: '#2563eb' },
    { name: 'Green', value: '#16a34a' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Beige', value: '#d4b896' },
    { name: 'Brown', value: '#78350f' },
];

// Helper to check if a widget is color-related
const isColorWidget = (widget: Widget): boolean => {
    const colorKeywords = ['color', 'colour', 'wash'];
    const fieldLower = widget.field.toLowerCase();
    const labelLower = widget.label.toLowerCase();
    return colorKeywords.some(kw => fieldLower.includes(kw) || labelLower.includes(kw));
};

export default function ClarificationWidget({
    message,
    widgets,
    parsedSoFar = {},
    onSubmit,
    onSkip,
}: ClarificationWidgetProps) {
    const [responses, setResponses] = useState<Record<string, any>>({});
    const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
    const [showCustomInput, setShowCustomInput] = useState<Record<string, boolean>>({});
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleChange = (field: string, value: any) => {
        setResponses((prev: Record<string, any>) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = () => {
        setIsCollapsed(true);
        // Merge custom inputs with responses
        const finalResponses = { ...responses };
        Object.entries(customInputs).forEach(([field, value]) => {
            if (value && showCustomInput[field]) {
                finalResponses[field] = value;
            }
        });
        // Small delay to allow collapse animation
        setTimeout(() => onSubmit(finalResponses), 300);
    };

    const handleSkip = () => {
        setIsCollapsed(true);
        if (onSkip) setTimeout(onSkip, 300);
    };

    // Build the status line showing ALL current selections (not just hardcoded ones)
    const getStatusLine = () => {
        const parts: string[] = [];

        // Iterate through all responses and format them appropriately
        Object.entries(responses).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') return;

            // Format the value based on key and type
            if (key === 'budget' && typeof value === 'number') {
                parts.push(`Up to $${value}`);
            } else if (key === 'size') {
                parts.push(`Size ${value}`);
            } else if (Array.isArray(value)) {
                // For checkbox groups, join the values
                if (value.length > 0) {
                    parts.push(value.join(', '));
                }
            } else if (typeof value === 'string') {
                // Capitalize first letter for display
                parts.push(value.charAt(0).toUpperCase() + value.slice(1));
            } else {
                parts.push(String(value));
            }
        });

        // Also include custom inputs
        Object.entries(customInputs).forEach(([field, value]) => {
            if (value && showCustomInput[field]) {
                parts.push(value);
            }
        });

        return parts.length > 0 ? parts.join(' • ') : 'Selections saved';
    };

    // Prepare widgets: Polls first, then Sliders
    const sliderWidgets = widgets.filter(w => w.type === 'slider');
    const otherWidgets = widgets.filter(w => w.type !== 'slider');
    const sortedWidgets = [...otherWidgets, ...sliderWidgets];

    const renderPollWidget = (widget: Widget) => (
        <div key={widget.field} className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-900 dark:text-white">
                {widget.label}
            </label>
            <div className="flex flex-wrap gap-2">
                {widget.options?.map((option, idx) => {
                    const isSelected = responses[widget.field] === option.value;
                    return (
                        <motion.button
                            key={option.value}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.03 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleChange(widget.field, option.value)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 ${isSelected
                                ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-md'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                                }`}
                        >
                            {isSelected && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-1.5 h-1.5 rounded-full bg-white dark:bg-black"
                                />
                            )}
                            <span>{option.label}</span>
                        </motion.button>
                    );
                })}

                {/* "Something else..." option */}
                <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (widget.options?.length || 0) * 0.03 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCustomInput(prev => ({ ...prev, [widget.field]: !prev[widget.field] }))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 ${showCustomInput[widget.field]
                        ? 'bg-gray-100 dark:bg-gray-700 border-gray-400 dark:border-gray-500'
                        : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                >
                    <span className="text-lg leading-none">+</span>
                    <span>Other</span>
                </motion.button>
            </div>

            {/* Custom input field */}
            <AnimatePresence>
                {showCustomInput[widget.field] && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden pt-1"
                    >
                        <input
                            type="text"
                            placeholder={`Type ${widget.label.toLowerCase()}...`}
                            value={customInputs[widget.field] || ''}
                            onChange={(e) => setCustomInputs(prev => ({ ...prev, [widget.field]: e.target.value }))}
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors text-xs"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    const renderSliderWidget = (widget: Widget) => {
        const minVal = widget.min ?? widget.min_value ?? 0;
        const maxVal = widget.max ?? widget.max_value ?? 500;
        const currentVal = responses[widget.field] ?? widget.default_value ?? minVal;
        const percentage = ((currentVal - minVal) / (maxVal - minVal)) * 100;

        return (
            <div key={widget.field} className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-700 mt-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-900 dark:text-white">
                        {widget.label}
                    </label>
                    <span className="text-sm font-bold text-black dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        ${currentVal}
                    </span>
                </div>
                <div className="relative pt-1 pb-1">
                    <input
                        type="range"
                        min={minVal}
                        max={maxVal}
                        step={widget.step || 10}
                        value={currentVal}
                        onChange={(e) => handleChange(widget.field, parseInt(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-black dark:accent-white"
                        style={{
                            background: `linear-gradient(to right, #000 0%, #000 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`
                        }}
                    />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                    <span>${minVal}</span>
                    <span>${maxVal}+</span>
                </div>
            </div>
        );
    };

    const renderColorPicker = (widget: Widget) => (
        <div key={widget.field} className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-900 dark:text-white">
                {widget.label}
            </label>
            <div className="flex flex-wrap gap-1.5 items-center">
                {COLOR_PALETTE.map((color) => (
                    <motion.button
                        key={color.value}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleChange(widget.field, color.name)}
                        className={`w-6 h-6 rounded-full border transition-all shadow-sm ${responses[widget.field] === color.name
                            ? 'ring-1 ring-offset-1 ring-black dark:ring-white border-black dark:border-white scale-110'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                            }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                    >
                        {responses[widget.field] === color.name && (
                            <svg className={`w-full h-full p-0.5 ${color.value === '#FFFFFF' ? 'text-black' : 'text-white'}`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        )}
                    </motion.button>
                ))}
                {/* Custom color picker circle */}
                {customInputs[widget.field] && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`w-6 h-6 rounded-full border-2 transition-all shadow-sm ${responses[widget.field] === customInputs[widget.field]
                            ? 'ring-1 ring-offset-1 ring-black dark:ring-white border-black dark:border-white scale-110'
                            : 'border-gray-300 dark:border-gray-600'
                            }`}
                        style={{ backgroundColor: customInputs[widget.field] }}
                        onClick={() => handleChange(widget.field, customInputs[widget.field])}
                        title={`Custom: ${customInputs[widget.field]}`}
                    />
                )}
                {/* Color picker button with rainbow gradient */}
                <motion.label
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 transition-all shadow-sm flex items-center justify-center cursor-pointer hover:border-gray-400 overflow-hidden"
                    title="Pick a custom color"
                    style={{ background: 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)' }}
                >
                    <input
                        type="color"
                        value={customInputs[widget.field] || '#000000'}
                        onChange={(e) => {
                            setCustomInputs(prev => ({ ...prev, [widget.field]: e.target.value }));
                            handleChange(widget.field, e.target.value);
                        }}
                        className="opacity-0 absolute w-0 h-0"
                    />
                </motion.label>
            </div>
        </div>
    );

    // Render color options as circles (for checkbox_group widgets with color-related fields)
    const renderColorCircles = (widget: Widget) => {
        const selectedColors = responses[widget.field] || [];

        return (
            <div key={widget.field} className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-900 dark:text-white">
                    {widget.label}
                </label>
                <div className="flex flex-wrap gap-2 items-center">
                    {widget.options?.map((option) => {
                        const colorValue = COLOR_MAP[option.value.toLowerCase()] || '#9ca3af';
                        const isGradient = colorValue.includes('gradient');
                        const isSelected = selectedColors.includes(option.value);
                        const isLightColor = ['white', '#ffffff', '#FFFFFF'].includes(colorValue.toLowerCase());

                        return (
                            <motion.button
                                key={option.value}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    if (isSelected) {
                                        handleChange(widget.field, selectedColors.filter((v: string) => v !== option.value));
                                    } else {
                                        handleChange(widget.field, [...selectedColors, option.value]);
                                    }
                                }}
                                className={`w-7 h-7 rounded-full border-2 transition-all shadow-sm flex items-center justify-center ${isSelected
                                    ? 'ring-2 ring-offset-1 ring-black dark:ring-white border-black dark:border-white scale-110'
                                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                                    }`}
                                style={{ background: colorValue }}
                                title={option.label}
                            >
                                {isSelected && (
                                    <svg className={`w-4 h-4 ${isLightColor ? 'text-black' : 'text-white'}`} fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </motion.button>
                        );
                    })}
                    {/* Custom color picker circle - shows when a custom color has been picked */}
                    {customInputs[widget.field] && (
                        <motion.button
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                const current = responses[widget.field] || [];
                                if (current.includes(customInputs[widget.field])) {
                                    handleChange(widget.field, current.filter((v: string) => v !== customInputs[widget.field]));
                                } else {
                                    handleChange(widget.field, [...current, customInputs[widget.field]]);
                                }
                            }}
                            className={`w-7 h-7 rounded-full border-2 transition-all shadow-sm flex items-center justify-center ${(responses[widget.field] || []).includes(customInputs[widget.field])
                                ? 'ring-2 ring-offset-1 ring-black dark:ring-white border-black dark:border-white scale-110'
                                : 'border-gray-300 dark:border-gray-600'
                                }`}
                            style={{ backgroundColor: customInputs[widget.field] }}
                            title={`Custom: ${customInputs[widget.field]}`}
                        >
                            {(responses[widget.field] || []).includes(customInputs[widget.field]) && (
                                <svg className="w-4 h-4 text-white mix-blend-difference" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            )}
                        </motion.button>
                    )}
                    {/* Color picker button with rainbow gradient */}
                    <motion.label
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-7 h-7 rounded-full border-2 border-gray-300 dark:border-gray-600 transition-all shadow-sm flex items-center justify-center cursor-pointer hover:border-gray-400 overflow-hidden"
                        title="Pick a custom color"
                        style={{ background: 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)' }}
                    >
                        <input
                            type="color"
                            value={customInputs[widget.field] || '#000000'}
                            onChange={(e) => {
                                const newColor = e.target.value;
                                setCustomInputs(prev => ({ ...prev, [widget.field]: newColor }));
                                // Automatically add the custom color to selection
                                const current = responses[widget.field] || [];
                                if (!current.includes(newColor)) {
                                    handleChange(widget.field, [...current, newColor]);
                                }
                            }}
                            className="opacity-0 absolute w-0 h-0"
                        />
                    </motion.label>
                </div>
            </div>
        );
    };

    const renderCheckboxWidget = (widget: Widget) => {
        // Check if this is a color-related widget
        if (isColorWidget(widget)) {
            return renderColorCircles(widget);
        }

        return (
            <div key={widget.field} className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-900 dark:text-white">
                    {widget.label}
                </label>
                <div className="flex flex-wrap gap-2">
                    {widget.options?.map((option) => {
                        const selected = (responses[widget.field] || []).includes(option.value);
                        return (
                            <motion.button
                                key={option.value}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => {
                                    const current = responses[widget.field] || [];
                                    if (selected) {
                                        handleChange(widget.field, current.filter((v: string) => v !== option.value));
                                    } else {
                                        handleChange(widget.field, [...current, option.value]);
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${selected
                                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                                    }`}
                            >
                                {selected && <span className="mr-1">✓</span>}
                                {option.label}
                            </motion.button>
                        );
                    })}
                    {/* "Other" option */}
                    <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowCustomInput(prev => ({ ...prev, [widget.field]: !prev[widget.field] }))}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${showCustomInput[widget.field]
                            ? 'bg-gray-100 dark:bg-gray-700 border-gray-400 dark:border-gray-500'
                            : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                            }`}
                    >
                        <span className="text-lg leading-none">+</span>
                        <span>Other</span>
                    </motion.button>
                </div>
                {/* Custom input field */}
                <AnimatePresence>
                    {showCustomInput[widget.field] && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden pt-1"
                        >
                            <input
                                type="text"
                                placeholder={`Type ${widget.label.toLowerCase()}...`}
                                value={customInputs[widget.field] || ''}
                                onChange={(e) => setCustomInputs(prev => ({ ...prev, [widget.field]: e.target.value }))}
                                className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors text-xs"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    const renderWidget = (widget: Widget, index: number) => {
        switch (widget.type) {
            case 'poll':
            case 'radio':
            case 'select':
                return renderPollWidget(widget);
            case 'slider':
                return renderSliderWidget(widget);
            case 'color_picker':
                return renderColorPicker(widget);
            case 'checkbox':
            case 'checkbox_group':
                return renderCheckboxWidget(widget);
            case 'text':
                return (
                    <div key={widget.field} className="space-y-1.5">
                        <label className="block text-sm font-semibold text-gray-900 dark:text-white">
                            {widget.label}
                        </label>
                        <input
                            type="text"
                            placeholder={widget.placeholder || 'Type here...'}
                            value={responses[widget.field] || ''}
                            onChange={(e) => handleChange(widget.field, e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors text-xs"
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    if (isCollapsed) {
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-lg max-w-3xl w-full"
        >
            {/* Header Row: Title + Parsed Tags + Action Buttons */}
            <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                        {message || "Refine your search"}
                    </h3>
                    {/* Already parsed info - inline */}
                    {Object.keys(parsedSoFar).length > 0 && Object.values(parsedSoFar).some(v => v) && (
                        <div className="flex flex-wrap gap-1.5">
                            {Object.entries(parsedSoFar).map(([key, value]) => (
                                value && (
                                    <span key={key} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] uppercase tracking-wide rounded font-semibold">
                                        {typeof value === 'string' ? value : key}
                                    </span>
                                )
                            ))}
                        </div>
                    )}
                </div>
                {/* Action Buttons - inline on the right */}
                <div className="flex gap-2 shrink-0">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSubmit}
                        disabled={Object.keys(responses).length === 0 && Object.keys(customInputs).length === 0}
                        className="py-1.5 px-4 bg-black dark:bg-white text-white dark:text-black text-xs font-bold rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        Continue
                    </motion.button>
                    {onSkip && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSkip}
                            className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs font-semibold hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                        >
                            Skip
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Widgets Grid - Polls side by side */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                {otherWidgets.map((widget, index) => (
                    <div key={widget.field} className="min-w-0">
                        {renderWidget(widget, index)}
                    </div>
                ))}
            </div>

            {/* Slider at bottom - full width */}
            {sliderWidgets.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    {sliderWidgets.map((widget, index) => renderSliderWidget(widget))}
                </div>
            )}
        </motion.div>
    );
}
