import { motion } from 'framer-motion';
import { ReactNode, useEffect } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  id: string;
}

const variants = {
  initial: {
    opacity: 0,
    x: 10,
    scale: 0.99,
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1], // Custom cubic-bezier for a modern "app" feel
    },
  },
  exit: {
    opacity: 0,
    x: -10,
    scale: 0.99,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

let hasShownInitial = false;

export const PageTransition = ({ children, id }: PageTransitionProps) => {
  const initialState = hasShownInitial ? 'initial' : false;
  useEffect(() => {
    hasShownInitial = true;
  }, []);

  return (
    <motion.div
      key={id}
      initial={initialState}
      animate="animate"
      exit="exit"
      variants={variants}
      style={{
        width: '100%',
        minHeight: '100%',
        position: 'relative',
      }}
    >
      {children}
    </motion.div>
  );
};
