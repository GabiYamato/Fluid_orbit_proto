import { motion } from "framer-motion";

export default function AnimatedBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2 text-white shadow-lg"
    >
      <span className="text-sm font-medium">Welcome — Framer Motion ✓</span>
    </motion.div>
  );
}
