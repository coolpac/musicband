import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  id: string;
}

const variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.1,
      ease: 'easeIn',
    },
  },
};

export const PageTransition = ({ children, id }: PageTransitionProps) => {
  return (
    <motion.div
      key={id}
      initial="initial"
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
