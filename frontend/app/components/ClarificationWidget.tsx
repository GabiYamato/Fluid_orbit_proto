'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface Widget {
    type: 'radio' | 'checkbox' | 'slider' | 'text';
    field: string;
    label: string;
    options?: Array<{ value: string; label: string }>;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
}

interface ClarificationWidgetProps {
    message: string;
    widgets: Widget[];
    parsedSoFar?: Record<string, any>;
    onSubmit: (responses: Record<string, any>) => void;
    onSkip?: () => void;
}

export default function ClarificationWidget({
    message,
    widgets,
    parsedSoFar = {},
    onSubmit,
    onSkip,
}: ClarificationWidgetProps) {
    const [responses, setResponses] = useState<Record<string, any>>({});

    const handleChange = (field: string, value: any) => {
        setResponses((prev: Record<string, any>) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = () => {
        onSubmit(responses);
    };

    const renderWidget = (widget: Widget, index: number) => {
        switch (widget.type) {
            case 'radio':
                return (
                    <div key={widget.field} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {widget.label}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {widget.options?.map((option) => (
                                <motion.button
                                    key={option.value}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleChange(widget.field, option.value)}
                                    className={`px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium ${responses[widget.field] === option.value
                                        ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                        }`}
                                >
                                    {option.label}
                                </motion.button>
                            ))}
                        </div>
                    </div>
                );

            case 'checkbox':
                return (
                    <div key={widget.field} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {widget.label}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {widget.options?.map((option) => {
                                const selected = (responses[widget.field] || []).includes(option.value);
                                return (
                                    <motion.button
                                        key={option.value}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            const current = responses[widget.field] || [];
                                            if (selected) {
                                                handleChange(widget.field, current.filter((v: string) => v !== option.value));
                                            } else {
                                                handleChange(widget.field, [...current, option.value]);
                                            }
                                        }}
                                        className={`px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium ${selected
                                            ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                            }`}
                                    >
                                        {selected && (
                                            <span className="mr-1">✓</span>
                                        )}
                                        {option.label}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>
                );

            case 'slider':
                return (
                    <div key={widget.field} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {widget.label}: <span className="font-bold">${responses[widget.field] || widget.min || 0}</span>
                        </label>
                        <input
                            type="range"
                            min={widget.min || 0}
                            max={widget.max || 1000}
                            step={widget.step || 50}
                            value={responses[widget.field] || widget.min || 0}
                            onChange={(e) => handleChange(widget.field, parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
                        />
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>${widget.min || 0}</span>
                            <span>${widget.max || 1000}</span>
                        </div>
                    </div>
                );

            case 'text':
                return (
                    <div key={widget.field} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {widget.label}
                        </label>
                        <input
                            type="text"
                            placeholder={widget.placeholder || 'Type here...'}
                            value={responses[widget.field] || ''}
                            onChange={(e) => handleChange(widget.field, e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                        />
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg"
        >
            {/* Question/Message */}
            <div className="flex items-start gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-black dark:bg-white flex items-center justify-center flex-shrink-0">
                    <span className="text-white dark:text-black text-lg">?</span>
                </div>
                <p className="text-gray-800 dark:text-gray-200 text-lg font-medium leading-relaxed">
                    {message}
                </p>
            </div>

            {/* Already parsed info */}
            {Object.keys(parsedSoFar).length > 0 && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">Got it so far:</p>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(parsedSoFar).map(([key, value]) => (
                            value && (
                                <span key={key} className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs rounded-full">
                                    {key}: {String(value)}
                                </span>
                            )
                        ))}
                    </div>
                </div>
            )}

            {/* Widgets */}
            <div className="space-y-4 mb-6">
                {widgets.map((widget, index) => renderWidget(widget, index))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmit}
                    className="flex-1 py-3 px-6 bg-black dark:bg-white text-white dark:text-black font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                >
                    Continue
                </motion.button>
                {onSkip && (
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onSkip}
                        className="py-3 px-6 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                    >
                        Skip
                    </motion.button>
                )}
            </div>
        </motion.div>
    );
}
