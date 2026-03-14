import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CombatState } from "@shared/types";

interface DiceOverlayProps {
  combatResult: CombatState | null;
  onDismiss: () => void;
}

export default function DiceOverlay({ combatResult, onDismiss }: DiceOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (combatResult) {
      setVisible(true);
      setRolling(true);
      const rollTimer = setTimeout(() => setRolling(false), 800);
      const dismissTimer = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 2500);
      return () => {
        clearTimeout(rollTimer);
        clearTimeout(dismissTimer);
      };
    }
  }, [combatResult, onDismiss]);

  if (!combatResult) return null;

  const pairs = Math.min(
    combatResult.attackerDice.length,
    combatResult.defenderDice.length,
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.6, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-gray-900/95 border border-gray-600 rounded-lg p-5 pointer-events-auto shadow-2xl"
          >
            <div className="flex gap-8">
              <div>
                <div className="text-xs text-red-400 font-semibold mb-2 text-center">Attacker</div>
                <div className="flex gap-1.5">
                  {combatResult.attackerDice.map((d, i) => (
                    <Die
                      key={i}
                      value={d}
                      win={i < pairs && d > combatResult.defenderDice[i]}
                      rolling={rolling}
                      delay={i * 0.1}
                      color="red"
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center text-gray-500 text-lg font-bold">VS</div>
              <div>
                <div className="text-xs text-blue-400 font-semibold mb-2 text-center">Defender</div>
                <div className="flex gap-1.5">
                  {combatResult.defenderDice.map((d, i) => (
                    <Die
                      key={i}
                      value={d}
                      win={i < pairs && d >= combatResult.attackerDice[i]}
                      rolling={rolling}
                      delay={i * 0.1 + 0.15}
                      color="blue"
                    />
                  ))}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {!rolling && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mt-3 text-center text-xs text-gray-400"
                >
                  {combatResult.attackerLosses > 0 && (
                    <span className="text-red-400">
                      Attacker loses {combatResult.attackerLosses}
                    </span>
                  )}
                  {combatResult.attackerLosses > 0 && combatResult.defenderLosses > 0 && (
                    <span> · </span>
                  )}
                  {combatResult.defenderLosses > 0 && (
                    <span className="text-blue-400">
                      Defender loses {combatResult.defenderLosses}
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Dot positions for standard die faces
const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

function Die({
  value,
  win,
  rolling,
  delay,
  color,
}: {
  value: number;
  win: boolean;
  rolling: boolean;
  delay: number;
  color: "red" | "blue";
}) {
  const bgWin = color === "red" ? "bg-red-600" : "bg-blue-600";
  const bgLose = "bg-gray-700";
  const borderWin = color === "red" ? "border-red-400" : "border-blue-400";
  const borderLose = "border-gray-600";

  const showResult = !rolling;
  const bg = showResult ? (win ? bgWin : bgLose) : "bg-gray-600";
  const border = showResult ? (win ? borderWin : borderLose) : "border-gray-500";

  return (
    <motion.div
      initial={{ rotate: 0, scale: 0.5 }}
      animate={
        rolling
          ? {
              rotate: [0, 90, 180, 270, 360, 450, 540],
              scale: [0.5, 1.1, 1, 1.1, 1, 1.1, 1],
            }
          : { rotate: 0, scale: 1 }
      }
      transition={
        rolling
          ? { duration: 0.7, delay, ease: "easeOut" }
          : { type: "spring", stiffness: 400, damping: 15 }
      }
      className={`w-10 h-10 rounded-lg border-2 ${bg} ${border} relative transition-colors duration-200`}
    >
      {showResult && (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {DOT_POSITIONS[value]?.map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={10} fill="white" opacity={0.9} />
          ))}
        </svg>
      )}
      {!showResult && (
        <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
          ?
        </div>
      )}
    </motion.div>
  );
}
