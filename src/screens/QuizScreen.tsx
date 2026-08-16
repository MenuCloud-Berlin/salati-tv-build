import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { FocusCard } from '@/components/FocusCard';
import { buildQuizRound, type QuizQuestion } from '@/data/quiz';
import { useTranslation } from '@/lib/i18n';
import { broadcast, onPairCommand, usePairingState } from '@/lib/pairing';
import type { Theme } from '@/lib/theme';
import { useTheme } from '@/lib/useTheme';
import { useLatestRef } from '@/lib/useLatestRef';

const ROUND = 10;

// Quiz: solo mit der Fernbedienung spielbar UND als Zweitschirm — ein
// gekoppeltes Handy sieht die Optionen und tippt die Antwort (kommt übers
// LAN-Pairing als { t:'quiz', action:'answer', option }). Beide Wege rufen
// dieselbe answer()-Logik. Fragen offline gebündelt (data/quiz.ts).
export function QuizScreen() {
  // `round` zieht eine frische Fragenmischung — Grundlage fuer „Nochmal spielen"
  // auf dem Ergebnis-Bildschirm (Audit 2026-07-28).
  const [round, setRound] = useState(0);
  const pairing = usePairingState();
  const { height, width } = useWindowDimensions();
  const { t, rtl, locale } = useTranslation();
  // Audit 2026-07-28 (T15): die Fragen kamen fest deutsch aus der Datei. Sie
  // werden jetzt in der App-Sprache gebaut — und die Optionen dabei gemischt,
  // weil in der Quelle die richtige Antwort immer an Position 0 steht.
  // `round` steht bewusst in der Abhaengigkeitsliste UND im Rumpf: „Neue
  // Runde" heisst neu mischen. Ohne die Nutzung im Rumpf meldet ESLint die
  // Abhaengigkeit als ueberfluessig — ein Entfernen wuerde die zweite Runde
  // mit denselben Fragen starten.
  const questions = useMemo<QuizQuestion[]>(
    () => (round >= 0 ? buildQuizRound(locale, ROUND) : []),
    [round, locale],
  );
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(height, width, rtl, theme), [height, width, rtl, theme]);

  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = questions[index];
  // Refs, damit der Pairing-Listener (einmal registriert) immer den aktuellen
  // Stand sieht, ohne bei jedem Antwort-Schritt neu zu abonnieren.
  const answeredRef = useLatestRef(answered);
  const answerFnRef = useRef<(i: number) => void>(() => {});
  // Der Weiter-Timer lief bisher ungebremst weiter: verliess man den Quiz-
  // Bildschirm oder startete eine neue Runde innerhalb der 1,4 s, feuerte er
  // trotzdem und schob die alte Runde weiter (Audit 2026-07-28).
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  function answer(optionIndex: number) {
    if (answeredRef.current !== null || !q) return;
    setAnswered(optionIndex);
    const correct = optionIndex === q.correct;
    const nextScore = correct ? score + 1 : score;
    setScore(nextScore);
    broadcast({ t: 'quiz', action: 'result', correct, correctOption: q.correct });
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      if (index + 1 < questions.length) {
        setAnswered(null);
        setIndex(index + 1);
      } else {
        setFinished(true);
        broadcast({ t: 'quiz', action: 'end', score: nextScore, total: questions.length });
      }
    }, 1400);
  }
  // Der Pairing-Listener ruft immer die aktuelle Antwortfunktion auf; die
  // Zuweisung liegt im Effekt statt im Render (react-hooks/refs).
  useEffect(() => {
    answerFnRef.current = answer;
  });

  function restart() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setRound((r) => r + 1);
    setIndex(0);
    setAnswered(null);
    setScore(0);
    setFinished(false);
  }

  // Frage an gekoppelte Handys spiegeln (sobald Frage wechselt / Handy verbindet).
  useEffect(() => {
    if (finished || !q) return;
    broadcast({ t: 'quiz', action: 'question', index, total: questions.length, q: q.q, options: q.options });
  }, [index, finished, q, questions.length, pairing.clients]);

  // Antworten vom Handy annehmen (einmal registriert).
  useEffect(() => {
    const off = onPairCommand((cmd) => {
      if (cmd.t === 'quiz' && cmd.action === 'answer' && typeof cmd.option === 'number') {
        answerFnRef.current(cmd.option);
      }
    });
    return () => {
      off();
    };
  }, []);

  // Audit 2026-07-28: Der Ergebnis-Bildschirm hatte KEIN fokussierbares Element
  // — auf Android TV verliert die Fernbedienung dort ihren Anker, D-Pad und OK
  // laufen ins Leere (derselbe Fehler wie am Clock-Screensaver 2026-07-24).
  // Der Hinweis „mit der Zurueck-Taste" war die einzige Ausstiegs-Erklaerung;
  // eine fokussierte „Nochmal spielen"-Karte ist Anker UND echte Aktion.
  if (finished) {
    return (
      <View style={styles.center}>
        <Text style={styles.resultEmoji}>{score === questions.length ? '🏆' : score >= questions.length * 0.6 ? '✨' : '📖'}</Text>
        <Text style={styles.resultScore}>
          {score} / {questions.length}
        </Text>
        <FocusCard hasTVPreferredFocus onPress={restart} style={styles.restartCard}>
          <Text style={styles.restartLabel}>{t('quiz.playAgain')}</Text>
        </FocusCard>
        <Text style={styles.resultHint}>{t('quiz.backHint')}</Text>
      </View>
    );
  }
  if (!q) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.counter}>
          {t('quiz.progress', { i: index + 1, n: questions.length })}
        </Text>
        <Text style={styles.score}>{score} ✓</Text>
      </View>

      <Text style={styles.question}>{q.q}</Text>

      <View style={styles.grid}>
        {q.options.map((opt, i) => {
          const isCorrect = answered !== null && i === q.correct;
          const isWrong = answered === i && i !== q.correct;
          return (
            <FocusCard
              key={i}
              hasTVPreferredFocus={i === 0}
              onPress={() => answer(i)}
              style={[styles.option, isCorrect && styles.optCorrect, isWrong && styles.optWrong]}>
              {/* Auch die SCHRIFT faerben: ein 3 dp starker Rahmen ist aus drei
                  Metern Sitzabstand kaum zu sehen (Audit 2026-07-29). */}
              <Text style={[styles.optText, isCorrect && styles.optTextCorrect, isWrong && styles.optTextWrong]}>
                {opt}
              </Text>
            </FocusCard>
          );
        })}
      </View>

      <Text style={styles.footer}>
        {pairing.clients > 0 ? t('quiz.answerPhoneOrRemote') : t('quiz.answerRemote')}
      </Text>
    </View>
  );
}

/** Höhen-relative Styles — fit-by-design auf jeder TV-Dichte (siehe ClockScreen). */
function makeStyles(h: number, w: number, rtl: boolean, theme: Theme) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const padV = clamp(h * 0.06, 24, 64);
  const padH = clamp(w * 0.06, 32, 100);
  const align = rtl ? ('right' as const) : ('left' as const);
  return StyleSheet.create({
    // `justifyContent: 'center'` statt oben buendig: Frage und vier
    // Antworten fuellen nur zwei Drittel der Hoehe, das letzte Drittel blieb
    // leer und das Bild kippte nach oben (Bildschirmbefund 2026-08-16).
    root: {
      flex: 1,
      paddingHorizontal: padH,
      paddingVertical: padV,
      justifyContent: 'center',
      gap: clamp(h * 0.02, 10, 24),
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    head: { flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' },
    counter: { color: theme.textMuted, fontSize: clamp(h * 0.038, 16, 26) },
    score: { color: theme.accent, fontSize: clamp(h * 0.042, 18, 28), fontWeight: '700' },
    question: {
      color: theme.text,
      fontSize: clamp(h * 0.062, 26, 52),
      fontWeight: '700',
      marginTop: clamp(h * 0.05, 20, 48),
      marginBottom: clamp(h * 0.045, 18, 44),
      lineHeight: clamp(h * 0.08, 34, 66),
      textAlign: align,
    },
    grid: { flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: clamp(w * 0.014, 12, 22) },
    option: { width: '48%', minHeight: clamp(h * 0.16, 84, 130), padding: clamp(h * 0.03, 16, 28), justifyContent: 'center' },
    optText: { color: theme.text, fontSize: clamp(h * 0.04, 20, 32), fontWeight: '600', textAlign: align },
    optCorrect: { borderColor: theme.ok, borderWidth: 3, backgroundColor: theme.okSoft },
    optWrong: { borderColor: theme.err, borderWidth: 3, backgroundColor: theme.errSoft },
    optTextCorrect: { color: theme.okText },
    optTextWrong: { color: theme.errText },
    footer: { color: theme.textMuted, fontSize: clamp(h * 0.034, 15, 24), textAlign: 'center', marginTop: clamp(h * 0.045, 18, 44) },
    resultEmoji: { fontSize: clamp(h * 0.14, 60, 96) },
    resultScore: { color: theme.accent, fontSize: clamp(h * 0.1, 44, 76), fontWeight: '800' },
    resultHint: { color: theme.textMuted, fontSize: clamp(h * 0.038, 16, 26) },
    restartCard: {
      paddingHorizontal: clamp(w * 0.04, 28, 64),
      paddingVertical: clamp(h * 0.028, 14, 24),
      alignItems: 'center',
      justifyContent: 'center',
    },
    restartLabel: { color: theme.text, fontSize: clamp(h * 0.04, 18, 28), fontWeight: '700' },
  });
}
