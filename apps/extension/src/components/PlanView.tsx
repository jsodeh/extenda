import React, { useState } from 'react';
import {
    CheckCircle2,
    Circle,
    AlertCircle,
    Loader,
    XCircle,
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

interface WorkflowStep {
    id: string;
    tool: string;
    description: string;
    params?: any;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    result?: any;
    error?: string;
}

interface PlanViewProps {
    steps: WorkflowStep[];
}

export default function PlanView({ steps }: PlanViewProps) {
    const [expandedSteps, setExpandedSteps] = useState<string[]>([]);
    const prefersReducedMotion =
        typeof window !== 'undefined'
            ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
            : false;

    const toggleStepExpansion = (stepId: string) => {
        setExpandedSteps((prev) =>
            prev.includes(stepId)
                ? prev.filter((id) => id !== stepId)
                : [...prev, stepId],
        );
    };

    const taskVariants = {
        hidden: {
            opacity: 0,
            y: prefersReducedMotion ? 0 : -5
        },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: prefersReducedMotion ? 'tween' : 'spring',
                stiffness: 500,
                damping: 30,
                duration: prefersReducedMotion ? 0.2 : undefined
            }
        },
        exit: {
            opacity: 0,
            y: prefersReducedMotion ? 0 : -5,
            transition: { duration: 0.15 }
        }
    };

    const detailsVariants = {
        hidden: {
            opacity: 0,
            height: 0,
            overflow: 'hidden'
        },
        visible: {
            opacity: 1,
            height: 'auto',
            overflow: 'visible',
            transition: {
                duration: 0.25,
                ease: [0.2, 0.65, 0.3, 0.9]
            }
        }
    };

    return (
        <div className="overflow-hidden">
            <LayoutGroup>
                <div className="py-2 overflow-hidden">
                    <ul className="space-y-0.5">
                        {steps.map((step, index) => {
                            const isExpanded = expandedSteps.includes(step.id);
                            const isCompleted = step.status === 'completed';

                            return (
                                <motion.li
                                    key={step.id}
                                    className={`${index !== 0 ? 'mt-0.5 pt-1' : ''} `}
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <motion.div
                                        className="group flex items-center px-1 py-0.5 rounded-sm hover:bg-muted/50 cursor-pointer transition-colors"
                                        onClick={() => toggleStepExpansion(step.id)}
                                    >
                                        <motion.div className="mr-2 flex-shrink-0">
                                            <AnimatePresence mode="wait">
                                                <motion.div
                                                    key={step.status}
                                                    initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                                                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                                    exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                                                    transition={{
                                                        duration: 0.2,
                                                        ease: [0.2, 0.65, 0.3, 0.9]
                                                    }}
                                                >
                                                    {step.status === 'completed' ? (
                                                        <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
                                                    ) : step.status === 'in-progress' ? (
                                                        <Loader className="h-4 w-4 text-blue-500 dark:text-blue-400 animate-spin" />
                                                    ) : step.status === 'failed' ? (
                                                        <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                                                    ) : (
                                                        <Circle className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </motion.div>
                                            </AnimatePresence>
                                        </motion.div>

                                        <div className="flex min-w-0 flex-grow items-center justify-between">
                                            <div className="mr-2 flex-1 truncate">
                                                <span className={`text-[10px] ${isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'} `}>
                                                    {step.description}
                                                </span>
                                            </div>

                                            <div className="flex flex-shrink-0 items-center space-x-1 text-[9px]">
                                                <motion.span
                                                    className="rounded px-1.5 py-0.5 text-[9px] font-medium bg-muted/50 text-muted-foreground"
                                                >
                                                    {step.tool}
                                                </motion.span>

                                                <motion.span
                                                    className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${step.status === 'completed'
                                                        ? 'bg-green-100/70 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : step.status === 'in-progress'
                                                            ? 'bg-blue-100/70 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                            : step.status === 'failed'
                                                                ? 'bg-red-100/70 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                                : 'bg-muted/50 text-muted-foreground'
                                                        } `}
                                                >
                                                    {step.status}
                                                </motion.span>
                                            </div>
                                        </div>
                                    </motion.div>

                                    <AnimatePresence mode="wait">
                                        {isExpanded && (
                                            <motion.div
                                                className="ml-4 mt-0.5 mb-0.5 text-[9px] text-foreground font-mono"
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.25 }}
                                            >
                                                {step.params && (
                                                    <div className="mb-1">
                                                        <span className="font-semibold text-muted-foreground">Parameters:</span>
                                                        <pre className="mt-0.5 rounded bg-muted/30 p-1 overflow-x-auto">
                                                            {JSON.stringify(step.params, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}

                                                {step.result && (
                                                    <div className="mb-1">
                                                        <span className="font-semibold text-muted-foreground">Result:</span>
                                                        <pre className="mt-0.5 rounded bg-muted/30 p-1 overflow-x-auto">
                                                            {JSON.stringify(step.result, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}

                                                {step.error && (
                                                    <div>
                                                        <span className="font-semibold text-destructive">Error:</span>
                                                        <p className="mt-1 text-destructive">{step.error}</p>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.li>
                            );
                        })}
                    </ul>
                </div>
            </LayoutGroup>
        </div>
    );
}
