"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface IntroSequenceProps {
  onComplete: () => void;
}

export function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [phase, setPhase] = useState(0);
  const [typedQuestion, setTypedQuestion] = useState("");
  const [typedResponse, setTypedResponse] = useState("");

  const question = "How many 'r' letters are in the word 'strawberry'?";
  const response = "The word 'strawberry' contains 2 letter 'r's.";

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Typing effect for question
  useEffect(() => {
    if (phase === 2) {
      let i = 0;
      const interval = setInterval(() => {
        if (i <= question.length) {
          setTypedQuestion(question.slice(0, i));
          i++;
        } else {
          clearInterval(interval);
        }
      }, 35);
      return () => clearInterval(interval);
    }
  }, [phase]);

  // Typing effect for response
  useEffect(() => {
    if (phase === 3) {
      let i = 0;
      const interval = setInterval(() => {
        if (i <= response.length) {
          setTypedResponse(response.slice(0, i));
          i++;
        } else {
          clearInterval(interval);
        }
      }, 25);
      return () => clearInterval(interval);
    }
  }, [phase]);

  useEffect(() => {
    const timings = [
      2500, // Phase 0->1: "SUBJECT UNDER EXAMINATION"
      1800, // Phase 1->2: Model name slides up
      2200, // Phase 2->3: Question types out
      2000, // Phase 3->4: AI responds
      1200, // Phase 4->5: "ANALYZING RESPONSE..."
      1800, // Phase 5->6: "WRONG" stamps down
      2000, // Phase 6->7: WinQA reveal
    ];

    let elapsed = 0;

    const timers = timings.map((delay, index) => {
      elapsed += delay;
      return setTimeout(() => {
        setPhase(index + 1);
        if (index + 1 >= 7) {
          setTimeout(onComplete, 2500);
        }
      }, elapsed);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden cursor-pointer"
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        onClick={handleSkip}
      >
        {/* Film grain overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.04,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
          }}
        />

        {/* Phase 0: "SUBJECT UNDER EXAMINATION" */}
        <AnimatePresence mode="wait">
          {phase === 0 && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.p
                className="font-mono text-white/40 text-xs sm:text-sm tracking-[0.3em] uppercase"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                Subject Under Examination
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase 1-4: Model name + question/response */}
        <AnimatePresence>
          {phase >= 1 && phase < 5 && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center px-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <motion.h2
                className="font-heading text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white text-center"
                initial={{ opacity: 0, y: 60, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                MODEL: GEMINI
              </motion.h2>

              <AnimatePresence>
                {phase >= 2 && (
                  <motion.div
                    className="mt-12 w-full max-w-2xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="border border-white/10 bg-white/[0.02] rounded-lg p-6">
                      <div className="mb-6">
                        <p className="font-mono text-white/40 text-xs mb-2 uppercase tracking-wider">Query</p>
                        <p className="text-white text-lg sm:text-xl">
                          {typedQuestion}
                          {phase === 2 && typedQuestion.length < question.length && (
                            <span className="inline-block w-0.5 h-5 bg-orange-500 ml-0.5 animate-pulse" />
                          )}
                        </p>
                      </div>

                      <AnimatePresence>
                        {phase >= 3 && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            <p className="font-mono text-white/40 text-xs mb-2 uppercase tracking-wider">Response</p>
                            <p className="text-white text-lg sm:text-xl">
                              {typedResponse.split("2 letter").map((part, i) =>
                                i === 0 ? part : (
                                  <span key={i}>
                                    <span className="text-orange-500 font-semibold">2 letter</span>
                                    {part}
                                  </span>
                                )
                              )}
                              {phase === 3 && typedResponse.length < response.length && (
                                <span className="inline-block w-0.5 h-5 bg-orange-500 ml-0.5 animate-pulse" />
                              )}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <AnimatePresence>
                      {phase >= 4 && phase < 5 && (
                        <motion.p
                          className="mt-6 text-center font-mono text-orange-500 text-sm tracking-wider"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 1, 0.5, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        >
                          ANALYZING RESPONSE...
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase 5-6: "WRONG" stamp */}
        <AnimatePresence>
          {phase >= 5 && phase < 7 && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="relative flex flex-col items-center justify-center"
                animate={{ x: [0, -10, 10, -5, 5, 0], y: [0, 5, -5, 3, -3, 0] }}
                transition={{ duration: 0.4 }}
              >
                <div className="relative">
                  <motion.span
                    className="absolute text-[80px] sm:text-[140px] md:text-[180px] font-bold tracking-tighter text-red-500/70"
                    style={{ transform: 'translate(-6px, -3px)' }}
                    initial={{ opacity: 0, scale: 1.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    WRONG
                  </motion.span>
                  <motion.span
                    className="absolute text-[80px] sm:text-[140px] md:text-[180px] font-bold tracking-tighter text-blue-500/70"
                    style={{ transform: 'translate(6px, 3px)' }}
                    initial={{ opacity: 0, scale: 1.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    WRONG
                  </motion.span>
                  <motion.span
                    className="relative text-[80px] sm:text-[140px] md:text-[180px] font-bold tracking-tighter text-white"
                    initial={{ opacity: 0, scale: 1.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    WRONG
                  </motion.span>
                </div>

                <motion.p
                  className="mt-8 font-mono text-white/60 text-sm sm:text-base text-center px-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  Correct answer: <span className="text-white">3 r&apos;s</span> (st<span className="text-orange-500">r</span>awbe<span className="text-orange-500">rr</span>y)
                </motion.p>
              </motion.div>

              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute left-0 right-0 h-px bg-red-500/50"
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: [0, 1, 0], opacity: [0, 1, 0] }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                  style={{ top: `${10 + i * 10}%` }}
                />
              ))}

              <motion.div
                className="absolute inset-0 bg-red-500 pointer-events-none"
                initial={{ opacity: 0.4 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase 7: WinQA reveal */}
        <AnimatePresence>
          {phase >= 7 && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              <motion.div
                className="absolute w-96 h-96 bg-orange-500/10 blur-[100px] rounded-full"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8 }}
              />

              <motion.h1
                className="relative font-heading text-[60px] sm:text-[100px] md:text-[140px] font-bold tracking-tight text-white"
                initial={{ scale: 0.8, opacity: 0, filter: 'blur(20px)' }}
                animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                Win<span className="text-orange-500">QA</span>
              </motion.h1>

              <motion.p
                className="mt-4 sm:mt-6 font-mono text-white/50 text-xs sm:text-sm tracking-[0.2em] uppercase"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                Trust nothing. Test everything.
              </motion.p>

              <motion.div
                className="mt-8 h-px w-24 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Skip hint */}
        <motion.p
          className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-white/20 text-xs tracking-wider"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          click anywhere to skip
        </motion.p>

        <KeyboardListener onSkip={handleSkip} />
      </motion.div>
    </AnimatePresence>
  );
}

function KeyboardListener({ onSkip }: { onSkip: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') {
        e.preventDefault();
        onSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSkip]);
  return null;
}
