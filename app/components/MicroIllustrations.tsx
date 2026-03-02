import { motion } from "motion/react";
import { Flame, Heart, Sparkles, MessageCircle, Zap, Key } from "lucide-react";

interface FloatingIconProps {
  icon: React.ReactNode;
  className?: string;
  delay?: number;
}

function FloatingIcon({ icon, className = "", delay = 0 }: FloatingIconProps) {
  return (
    <motion.div
      className={`absolute opacity-20 ${className}`}
      animate={{
        y: ["0px", "-10px", "0px"],
        rotate: ["0deg", "5deg", "-3deg", "0deg"],
      }}
      transition={{
        duration: 3.5 + delay * 0.5,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    >
      {icon}
    </motion.div>
  );
}

export function MicroIllustrations() {
  return (
    <>
      <FloatingIcon
        icon={<Flame size={22} color="#C8522A" />}
        className="top-[12%] left-[15%] rotate-[-12deg]"
        delay={0}
      />
      <FloatingIcon
        icon={<Heart size={18} color="#C8522A" />}
        className="top-[8%] right-[20%] rotate-[15deg]"
        delay={0.4}
      />
      <FloatingIcon
        icon={<Sparkles size={20} color="#C8522A" />}
        className="top-[22%] right-[12%] rotate-[-8deg]"
        delay={0.8}
      />
      <FloatingIcon
        icon={<MessageCircle size={24} color="#C8522A" />}
        className="top-[18%] left-[8%] rotate-[20deg]"
        delay={0.2}
      />
      <FloatingIcon
        icon={<Zap size={16} color="#C8522A" />}
        className="bottom-[35%] right-[15%] rotate-[10deg]"
        delay={1.0}
      />
      <FloatingIcon
        icon={<Key size={18} color="#C8522A" />}
        className="bottom-[30%] left-[12%] rotate-[-15deg]"
        delay={0.6}
      />
      <FloatingIcon
        icon={<Heart size={14} color="#C8522A" />}
        className="bottom-[38%] left-[35%] rotate-[25deg]"
        delay={1.2}
      />
      <FloatingIcon
        icon={<Flame size={16} color="#C8522A" />}
        className="top-[30%] left-[42%] rotate-[5deg]"
        delay={0.9}
      />
    </>
  );
}
