// Teacher quiz builder: title, window, time limit and any number of single-choice,
// multi-choice or true/false questions with marks. Correct answers never reach students.
import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Modal, Input, Textarea } from '../../components/ui/index.js';
import { useToast, errorMessage } from '../../components/ui/Toast.js';
import { api } from '../../lib/api.js';
import { Quiz } from '../../types/index.js';

type QType = 'mcq_single' | 'mcq_multi' | 'true_false';
interface DraftQuestion {
  key: number;
  type: QType;
  prompt: string;
  marks: string;
  options: string[];
  correct: number[];
}

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];
let counter = 1;
const blankQuestion = (type: QType = 'mcq_single'): DraftQuestion => ({
  key: counter++, type, prompt: '', marks: '5',
  options: type === 'true_false' ? ['True', 'False'] : ['', '', '', ''],
  correct: []
});

const localInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export const QuizBuilderModal: React.FC<{ isOpen: boolean; courseId: string; onClose: () => void; onCreated: (quiz: Quiz) => void }> = ({ isOpen, courseId, onClose, onCreated }) => {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minutes, setMinutes] = useState('20');
  const [opens, setOpens] = useState(() => localInput(new Date()));
  const [closes, setCloses] = useState(() => localInput(new Date(Date.now() + 7 * 86400000)));
  const [publish, setPublish] = useState(true);
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => [blankQuestion()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (key: number, patch: Partial<DraftQuestion>) => setQuestions(current => current.map(q => q.key === key ? { ...q, ...patch } : q));
  const changeType = (q: DraftQuestion, type: QType) => update(q.key, { type, correct: [], options: type === 'true_false' ? ['True', 'False'] : q.options.length >= 2 && q.type !== 'true_false' ? q.options : ['', '', '', ''] });
  const toggleCorrect = (q: DraftQuestion, index: number) => {
    if (q.type === 'mcq_multi') update(q.key, { correct: q.correct.includes(index) ? q.correct.filter(i => i !== index) : [...q.correct, index] });
    else update(q.key, { correct: [index] });
  };
  const reset = () => { setTitle(''); setDescription(''); setMinutes('20'); setOpens(localInput(new Date())); setCloses(localInput(new Date(Date.now() + 7 * 86400000))); setPublish(true); setQuestions([blankQuestion()]); setError(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (new Date(closes).getTime() <= new Date(opens).getTime()) { setError('The closing time must be after the opening time.'); return; }
    const built = [];
    for (const [index, q] of questions.entries()) {
      const number = index + 1;
      if (q.prompt.trim().length < 2) { setError(`Question ${number} needs a prompt.`); return; }
      const marks = Number(q.marks);
      if (!(marks > 0)) { setError(`Question ${number} needs marks greater than zero.`); return; }
      const filled = q.options.map((text, i) => ({ text: text.trim(), i })).filter(o => o.text.length > 0);
      if (filled.length < 2) { setError(`Question ${number} needs at least two answer options.`); return; }
      const correct = q.correct.filter(i => filled.some(o => o.i === i));
      if (correct.length === 0) { setError(`Question ${number}: mark the correct answer.`); return; }
      if (q.type === 'mcq_multi' && correct.length < 2) { setError(`Question ${number}: a multi-select question needs at least two correct answers (or change it to single choice).`); return; }
      const ids = q.type === 'true_false' ? ['true', 'false'] : filled.map((_, n) => LETTERS[n]);
      const options = filled.map((o, n) => ({ id: ids[n], text: o.text }));
      built.push({ position: number, type: q.type, prompt: q.prompt.trim(), options, correctOptionIds: correct.map(i => ids[filled.findIndex(o => o.i === i)]), marks });
    }
    setSaving(true);
    try {
      const quiz = await api.createQuiz(courseId, {
        title: title.trim(), description: description.trim() || undefined, timeLimitMinutes: Number(minutes),
        opensAt: new Date(opens).toISOString(), closesAt: new Date(closes).toISOString(), isPublished: publish, questions: built
      });
      toast.success('Quiz created', publish ? 'Students can see it from the opening time.' : 'It is saved as a draft; publish it when ready.');
      onCreated(quiz);
      reset();
      onClose();
    } catch (reason) {
      setError(errorMessage(reason, 'The quiz was not saved.'));
      toast.error('Quiz was not saved', errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create a quiz" subtitle="Auto-graded; students get one attempt within the window" maxWidth="2xl">
      <form onSubmit={submit} className="space-y-5">
        <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Quiz 2: Databases" minLength={3} required />
        <Textarea label="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} placeholder="What does it cover?" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Time limit (minutes)" type="number" min={1} max={240} value={minutes} onChange={e => setMinutes(e.target.value)} required />
          <Input label="Opens" type="datetime-local" value={opens} onChange={e => setOpens(e.target.value)} required />
          <Input label="Closes" type="datetime-local" value={closes} onChange={e => setCloses(e.target.value)} required />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} /> Publish now (uncheck to save as a draft)
        </label>

        <div className="space-y-4">
          {questions.map((q, index) => (
            <fieldset key={q.key} className="space-y-3 rounded-2xl border border-slate-200 p-4">
              <legend className="px-1 text-xs font-extrabold text-navy-900">Question {index + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-[1fr,10rem,6rem]">
                <Input label="Prompt" value={q.prompt} onChange={e => update(q.key, { prompt: e.target.value })} required />
                <div>
                  <label htmlFor={`qt-${q.key}`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">Type</label>
                  <select id={`qt-${q.key}`} value={q.type} onChange={e => changeType(q, e.target.value as QType)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-navy-600 focus:outline-none">
                    <option value="mcq_single">Single choice</option>
                    <option value="mcq_multi">Multi select</option>
                    <option value="true_false">True / False</option>
                  </select>
                </div>
                <Input label="Marks" type="number" min={0.5} step="0.5" value={q.marks} onChange={e => update(q.key, { marks: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-slate-500">{q.type === 'mcq_multi' ? 'Tick every correct answer' : 'Select the correct answer'}</p>
                {q.options.map((text, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type={q.type === 'mcq_multi' ? 'checkbox' : 'radio'} name={`correct-${q.key}`} checked={q.correct.includes(i)} onChange={() => toggleCorrect(q, i)}
                      aria-label={`Option ${i + 1} is correct`}
                    />
                    {q.type === 'true_false' ? (
                      <span className="text-sm font-semibold text-slate-700">{text}</span>
                    ) : (
                      <input type="text" value={text} onChange={e => update(q.key, { options: q.options.map((o, n) => n === i ? e.target.value : o) })} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1} text`} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-100" />
                    )}
                    {q.type !== 'true_false' && q.options.length > 2 && (
                      <button type="button" aria-label={`Remove option ${i + 1}`} onClick={() => update(q.key, { options: q.options.filter((_, n) => n !== i), correct: q.correct.filter(c => c !== i).map(c => c > i ? c - 1 : c) })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                ))}
                {q.type !== 'true_false' && q.options.length < 6 && (
                  <button type="button" onClick={() => update(q.key, { options: [...q.options, ''] })} className="text-xs font-bold text-navy-700 hover:text-navy-900">+ Add option</button>
                )}
              </div>
              {questions.length > 1 && (
                <div className="text-right"><button type="button" onClick={() => setQuestions(current => current.filter(item => item.key !== q.key))} className="text-xs font-bold text-rose-600 hover:text-rose-800">Remove question</button></div>
              )}
            </fieldset>
          ))}
          <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setQuestions(current => [...current, blankQuestion()])}>Add question</Button>
        </div>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</p>}
        <Button type="submit" variant="gold" className="w-full font-bold" isLoading={saving}>Create quiz</Button>
      </form>
    </Modal>
  );
};
