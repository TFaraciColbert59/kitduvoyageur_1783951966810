'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useV5, type V5Api } from '../context';
import { addExpenseAction, deleteExpenseAction, settleExpenseAction, updateExpenseAction } from '@/app/voyages/budget-actions';
import { compasSetBudgetAction } from '../../server/compasActions';
import { moneyIn } from '../../components/sheetsI18n';
import { formatDate, formatNumber } from '@/lib/i18n/format';
import { Bar, Cap, Chip, Fi, Grp, Li, MBtn, PBtn, Stepper } from '../ui/primitives';
import { V5Icon, type V5IconName } from '../ui/icons';
import {
  ENVELOPE_MAX,
  ENVELOPE_STEP,
  EXPENSE_LABEL_MAX,
  EXPENSE_LABEL_MIN,
  EXPENSE_MAX,
  POST_KEYS,
  POST_STORED,
  addFormData,
  budgetTabAt,
  budgetTabs,
  budgetTotal,
  canRestore,
  envelopeView,
  expenseGroups,
  fxViews,
  parseEnvelope,
  postOf,
  postRows,
  proposeEnvelope,
  restoreFields,
  settleFormData,
  settleView,
  updateFormData,
  validateExpenseDraft,
  type DraftIssues,
  type ExpenseCtx,
  type ExpenseRow,
  type PostKey,
} from '../model/budget';
import { budgetText, type BudgetText } from '../model/text';
import type { V5DrawerDef } from './types';
import './nous-budget.css';

/** Tiroir « Budget » : aperçu, dépenses, et (en groupe) qui doit quoi. Le Compas compte, il ne paie rien. */

const POST_ICON: Record<PostKey, V5IconName> = {
  lodging: 'bed',
  food: 'cup',
  transport: 'car',
  activities: 'hike',
  gear: 'bag',
  misc: 'receipt',
  custom: 'receipt',
};

function useBudget() {
  const api = useV5();
  const text = budgetText(api.t, api.locale);
  const { model, viewerId } = api.data;
  const { tripId, slug, budget, crew } = model;
  const money = (n: number | null | undefined) => moneyIn(api.locale, n, budget.currency);
  const ctx: ExpenseCtx = { tripId, slug, currency: budget.currency };
  const nameOf = (id: string) => crew.loads.find((m) => m.userId === id)?.name ?? null;
  return { api, text, model, viewerId, ctx, budget, crew, money, nameOf };
}

function BudgetBody() {
  const { api, text, budget, money } = useBudget();
  const tab = budgetTabAt(api.solo, api.tab);
  const total = budgetTotal(budget);
  const perPerson = budget.perPerson;
  return (
    <>
      <p className="v5-sr" role="status" aria-live="polite">
        {api.solo || perPerson == null
          ? text('overview.liveSolo', { total: money(total) })
          : text('overview.live', { total: money(total), perPerson: money(perPerson) })}
      </p>
      {!api.canEdit && <p className="v5-note">{text('readOnly')}</p>}
      {tab === 'overview' && <Overview />}
      {tab === 'expenses' && <Expenses />}
      {tab === 'settle' && <Settle />}
    </>
  );
}

/* ---------- Aperçu ---------- */

function Overview() {
  const { api, text, ctx, budget, money } = useBudget();
  const { ctl, canEdit, solo, locale } = api;
  const env = envelopeView(budget);
  const [error, setError] = useState(false);
  const suggestion = proposeEnvelope(env.total);

  const setEnvelope = (amount: number | null, message: string) => {
    const before = budget.target;
    return ctl.run(
      message,
      () => compasSetBudgetAction({ tripId: ctx.tripId, tripSlug: ctx.slug, amount }),
      () => compasSetBudgetAction({ tripId: ctx.tripId, tripSlug: ctx.slug, amount: before })
    );
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = String(new FormData(e.currentTarget).get('envelope') ?? '');
    const check = parseEnvelope(raw);
    if (!check.ok) {
      setError(true);
      return;
    }
    setError(false);
    void setEnvelope(check.amount, text('envelope.saved', { amount: money(check.amount) }));
  };

  const rows = postRows(budget.byCategory);
  const fx = fxViews(api.data.budgetFx, budget.currency, [
    { id: 'envelope', amount: env.amount },
    { id: 'planned', amount: env.total },
    { id: 'spent', amount: budget.spent },
    { id: 'perPerson', amount: solo ? null : budget.perPerson },
  ]);
  const date = (iso: string) => formatDate(new Date(`${iso.slice(0, 10)}T12:00:00Z`), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }, locale) || iso;

  return (
    <>
      <Grp className="nb-card">
        <div className="v5-big">
          <b className="v5-num">{money(env.total)}</b>
          <span>
            {solo || budget.perPerson == null ? text('overview.bigSolo') : text('overview.big', { perPerson: money(budget.perPerson) })}
          </span>
        </div>
        {budget.spent > 0 && <p className="v5-src">{text('overview.spentIn', { amount: money(budget.spent) })}</p>}
        {env.amount != null && env.usedPct != null && env.gap != null ? (
          <>
            <div role="img" aria-label={text('envelope.usedAria', { pct: env.usedPct })}>
              <Bar pct={env.barPct} over={env.over} />
            </div>
            <div className={`v5-stl${env.over ? ' nb-over' : ''}`}>
              <span>{env.over ? text('envelope.over', { amount: money(env.gap) }) : text('envelope.remaining', { amount: money(env.gap) })}</span>
            </div>
          </>
        ) : (
          <p className="v5-note">{text('envelope.none')}</p>
        )}
        <div className="v5-stl nb-env">
          <span>
            {text('envelope.label')} {env.proposed && env.amount != null && <span className="v5-okc">{text('envelope.proposed')}</span>}
          </span>
          <span className="nb-env__ctl">
            {env.amount != null && (
              <span className="nb-stp">
                <Stepper
                  value={env.amount}
                  min={ENVELOPE_STEP}
                  max={ENVELOPE_MAX}
                  step={ENVELOPE_STEP}
                  disabled={!canEdit || ctl.busy}
                  lessLabel={text('envelope.less', { step: money(ENVELOPE_STEP) })}
                  moreLabel={text('envelope.more', { step: money(ENVELOPE_STEP) })}
                  onChange={(next) => void setEnvelope(next, text('envelope.saved', { amount: money(next) }))}
                />
              </span>
            )}
            <b className="v5-num nb-env__val">{env.amount != null ? money(env.amount) : '—'}</b>
          </span>
        </div>
        {env.proposed && env.amount != null && <p className="v5-src">{text('envelope.basis', { step: money(ENVELOPE_STEP) })}</p>}
        <div className="nb-actions nb-actions--flush">
          {env.proposed && env.amount != null && (
            <MBtn className="nb-btn" disabled={!canEdit || ctl.busy} onClick={() => void setEnvelope(env.amount, text('envelope.saved', { amount: money(env.amount) }))}>
              {text('envelope.keep')}
            </MBtn>
          )}
          {env.fixed != null && suggestion != null && (
            <MBtn className="nb-btn" disabled={!canEdit || ctl.busy} onClick={() => void setEnvelope(null, text('envelope.resetDone'))}>
              {text('envelope.reset')}
            </MBtn>
          )}
        </div>
        <form className="nb-env__form" onSubmit={onSubmit} noValidate>
          <fieldset className="nb-fieldset" disabled={!canEdit}>
            <label className="nb-field nb-field--grow">
              <span>{text('envelope.field', { currency: budget.currency })}</span>
              <input
                key={env.fixed ?? 'proposed'}
                className="v5-inp"
                name="envelope"
                inputMode="decimal"
                defaultValue={env.fixed ?? ''}
                aria-invalid={error || undefined}
                aria-describedby={error ? 'nb-env-err' : undefined}
              />
            </label>
            <button type="submit" className="v5-mbtn p nb-btn" disabled={ctl.busy}>
              {text('envelope.set')}
            </button>
          </fieldset>
          {error && (
            <p id="nb-env-err" role="alert" className="nb-err">
              {text('envelope.invalid', { max: money(ENVELOPE_MAX) })}
            </p>
          )}
        </form>
      </Grp>

      <Cap right={text('posts.spent', { amount: money(budget.spent) })}>{text('posts.cap')}</Cap>
      {rows.length ? (
        <Grp>
          {rows.map((r) => (
            <div key={`${r.key}:${r.label ?? ''}`} className="v5-li nb-post">
              <Fi icon={POST_ICON[r.key]} />
              <span className="t">
                <b>{r.key === 'custom' ? r.label : text(`cat.${r.key}`)}</b>
                <small>{text('posts.share', { pct: r.pct })}</small>
                <Bar pct={r.pct} />
              </span>
              <span className="v v5-num">{money(r.amount)}</span>
            </div>
          ))}
        </Grp>
      ) : (
        <p className="v5-note">{text('posts.empty')}</p>
      )}

      {fx.length > 0 && <Cap>{text('fx.cap')}</Cap>}
      {fx.map((f) => (
        <Grp key={f.currency} className="nb-fx" data-testid={`fx-${f.currency}`}>
          <b className="nb-fx__title">
            {text(f.kinds.length > 1 ? 'fx.both' : f.kinds[0] === 'voyageur' ? 'fx.you' : 'fx.country', { currency: f.currency })}
          </b>
          {f.unavailable ? (
            <p className="v5-note">{text('fx.unavailable', { currency: f.currency })}</p>
          ) : (
            <>
              {f.parts.map((p) => (
                <div key={p.id} className="v5-stl">
                  <span>{text(`fx.${p.id}`)}</span>
                  <b className="v5-num">≈ {moneyIn(locale, p.amount, f.currency)}</b>
                </div>
              ))}
              <p className="v5-src">
                {text('fx.rate', {
                  base: budget.currency,
                  rate: formatNumber(f.rate ?? 0, { maximumSignificantDigits: 4 }, locale),
                  currency: f.currency,
                  date: date(f.date ?? ''),
                  source: f.source ?? '',
                })}
              </p>
            </>
          )}
        </Grp>
      ))}
      <p className="v5-src">{text('currencyNote', { currency: budget.currency })}</p>
    </>
  );
}

/* ---------- Formulaire de dépense (ajout et modification) ---------- */

function ExpenseForm({ edit, onDone }: { edit?: ExpenseRow; onDone?: () => void }) {
  const { api, text, ctx, viewerId, crew, budget, money } = useBudget();
  const { ctl, canEdit, solo } = api;
  const first = crew.loads[0]?.userId ?? null;
  const [title, setTitle] = useState(edit?.title ?? '');
  const [amount, setAmount] = useState(edit ? String(edit.amount).replace('.', ',') : '');
  const [payer, setPayer] = useState<string | null>(edit?.payerId ?? viewerId ?? first);
  const [post, setPost] = useState<PostKey>(edit ? postOf(edit.categoryRaw).key : 'food');
  const [planned, setPlanned] = useState(false);
  const [issues, setIssues] = useState<DraftIssues>({});
  const [failed, setFailed] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const customLabel = edit ? postOf(edit.categoryRaw).label : null;
  const categoryOf = () => (post === 'custom' ? (edit?.categoryRaw?.trim() ?? POST_STORED.misc) : POST_STORED[post]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const check = validateExpenseDraft({ title, amount });
    if (!check.ok) {
      setIssues(check.issues);
      (check.issues.title ? titleRef : amountRef).current?.focus();
      return;
    }
    setIssues({});
    setFailed(false);
    const payerId = solo ? null : payer;
    let ok: boolean;
    if (edit) {
      const before = { title: edit.title, amount: edit.amount, category: edit.categoryRaw?.trim() || POST_STORED.misc, payerId: edit.payerId };
      ok = await ctl.run(
        text('exp.updated', { title: check.title }),
        () => updateExpenseAction(null, updateFormData(ctx, edit.id, { title: check.title, amount: check.amount, category: categoryOf(), payerId })),
        () => updateExpenseAction(null, updateFormData(ctx, edit.id, before))
      );
    } else {
      ok = await ctl.run(text('exp.added', { title: check.title }), () =>
        addExpenseAction(null, addFormData(ctx, { title: check.title, amount: check.amount, category: categoryOf(), payerId, planned }))
      );
    }
    if (!ok) {
      setFailed(true);
      return;
    }
    if (!edit) {
      setTitle('');
      setAmount('');
    }
    onDone?.();
  };

  const idp = edit ? `nb-e-${edit.id}` : 'nb-add';
  return (
    <form className="v5-grp nb-form" onSubmit={(e) => void onSubmit(e)} noValidate aria-label={edit ? text('form.editCap') : text('form.cap')}>
      <fieldset className="nb-fieldset nb-fieldset--col" disabled={!canEdit}>
        <label className="nb-field">
          <span>{text('form.label')}</span>
          <input
            ref={titleRef}
            className="v5-inp"
            value={title}
            maxLength={EXPENSE_LABEL_MAX}
            placeholder={text('form.labelHint')}
            aria-required="true"
            aria-invalid={issues.title ? true : undefined}
            aria-describedby={issues.title ? `${idp}-title-err` : undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        {issues.title && (
          <p id={`${idp}-title-err`} role="alert" className="nb-err">
            {text('form.errLabel', { min: EXPENSE_LABEL_MIN, max: EXPENSE_LABEL_MAX })}
          </p>
        )}
        <label className="nb-field">
          <span>{text('form.amount', { currency: budget.currency })}</span>
          <input
            ref={amountRef}
            className="v5-inp v5-num"
            inputMode="decimal"
            value={amount}
            aria-required="true"
            aria-invalid={issues.amount ? true : undefined}
            aria-describedby={issues.amount ? `${idp}-amount-err` : undefined}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        {issues.amount && (
          <p id={`${idp}-amount-err`} role="alert" className="nb-err">
            {issues.amount === 'max' ? text('form.errAmountMax', { max: money(EXPENSE_MAX) }) : text('form.errAmount')}
          </p>
        )}
        {!solo && (
          <div role="group" aria-label={text('form.payer')} className="nb-chips">
            <span className="nb-chips__t">{text('form.payer')}</span>
            <div className="v5-chips">
              {crew.loads.map((m) => (
                <Chip key={m.userId} pressed={payer === m.userId} onClick={() => setPayer(m.userId)}>
                  {m.name}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <div role="group" aria-label={text('form.category')} className="nb-chips">
          <span className="nb-chips__t">{text('form.category')}</span>
          <div className="v5-chips">
            {POST_KEYS.map((k) => (
              <Chip key={k} pressed={post === k} onClick={() => setPost(k)}>
                {text(`cat.${k}`)}
              </Chip>
            ))}
            {customLabel && (
              <Chip pressed={post === 'custom'} onClick={() => setPost('custom')}>
                {customLabel}
              </Chip>
            )}
          </div>
        </div>
        {!edit && (
          <div role="group" aria-label={text('form.state')} className="nb-chips">
            <span className="nb-chips__t">{text('form.state')}</span>
            <div className="v5-chips">
              <Chip pressed={!planned} onClick={() => setPlanned(false)}>
                {text('form.paid')}
              </Chip>
              <Chip pressed={planned} onClick={() => setPlanned(true)}>
                {text('form.planned')}
              </Chip>
            </div>
          </div>
        )}
        {failed && (
          <p role="alert" className="nb-err">
            {text('form.errSave')}
          </p>
        )}
        <div className="nb-actions nb-actions--flush">
          <PBtn type="submit" disabled={ctl.busy}>
            <V5Icon name={edit ? 'check' : 'plus'} size="s" />
            {edit ? text('form.save') : text('form.add')}
          </PBtn>
          {edit && (
            <MBtn className="nb-btn" onClick={onDone}>
              {text('form.cancel')}
            </MBtn>
          )}
        </div>
      </fieldset>
    </form>
  );
}

/* ---------- Une dépense ---------- */

function ExpenseItem({ row, compact }: { row: ExpenseRow; compact?: boolean }) {
  const { api, text, ctx, crew, money } = useBudget();
  const { ctl, canEdit, solo } = api;
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [payer, setPayer] = useState(row.payerId);

  if (editing) return <ExpenseForm edit={row} onDone={() => setEditing(false)} />;

  const who = row.payerName ?? text('exp.unknownPayer');
  const split =
    row.splitType === 'custom'
      ? text('exp.custom')
      : row.splitType === 'individual'
        ? text('exp.individual')
        : !solo
          ? text('exp.sharedTo', { count: api.people })
          : null;
  const state = row.planned ? (solo ? text('exp.plannedSolo') : text('exp.plannedBy', { name: who })) : solo ? text('exp.paidSolo') : text('exp.paidBy', { name: who });
  const post = row.post === 'custom' ? row.postLabel : text(`cat.${row.post}`);
  const detail = [post, state, split].filter(Boolean).join(' · ');

  const remove = () => {
    const restorable = canRestore(row);
    if (!restorable && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    void ctl.run(
      text('exp.deleted', { title: row.title }),
      () => deleteExpenseAction(ctx.tripId, row.id, ctx.slug),
      restorable ? () => addExpenseAction(null, addFormData(ctx, restoreFields(row))) : undefined
    );
  };

  const settle = (payerId: string | null) => {
    setChoosing(false);
    void ctl.run(
      text('exp.settled', { title: row.title }),
      () => settleExpenseAction(null, settleFormData(ctx, row.id, payerId)),
      () => updateExpenseAction(null, updateFormData(ctx, row.id, { planned: true, payerId: row.payerId }))
    );
  };

  return (
    <div className="v5-li nb-row">
      <Fi icon={POST_ICON[row.post]} />
      <span className="t">
        <b>{row.title}</b>
        <small>{detail}</small>
      </span>
      <span className="v v5-num">{money(row.amount)}</span>
      <div className="nb-actions">
        {confirming ? (
          <>
            <span className="v5-note">{text('exp.deleteConfirm')}</span>
            <MBtn className="nb-btn" disabled={ctl.busy} onClick={remove} aria-label={text('exp.deleteAria', { title: row.title })}>
              {text('exp.delete')}
            </MBtn>
            <MBtn className="nb-btn" onClick={() => setConfirming(false)}>
              {text('exp.keep')}
            </MBtn>
          </>
        ) : choosing ? (
          <div role="group" aria-label={text('exp.settlePayer')} className="nb-chips nb-chips--row">
            <span className="nb-chips__t">{text('exp.settlePayer')}</span>
            <div className="v5-chips">
              {crew.loads.map((m) => (
                <Chip key={m.userId} pressed={payer === m.userId} onClick={() => setPayer(m.userId)}>
                  {m.name}
                </Chip>
              ))}
            </div>
            <MBtn className="nb-btn" primary disabled={ctl.busy} onClick={() => settle(payer)}>
              {text('exp.settleConfirm')}
            </MBtn>
          </div>
        ) : (
          <>
            {row.planned && (
              <MBtn
                className="nb-btn"
                primary
                disabled={!canEdit || ctl.busy}
                aria-label={text('exp.settleAria', { title: row.title })}
                onClick={() => (solo ? settle(null) : setChoosing(true))}
              >
                {text('exp.settle')}
              </MBtn>
            )}
            {!compact && (
              <>
                <MBtn className="nb-btn" disabled={!canEdit || ctl.busy} aria-label={text('exp.editAria', { title: row.title })} onClick={() => setEditing(true)}>
                  {text('exp.edit')}
                </MBtn>
                <MBtn className="nb-btn" disabled={!canEdit || ctl.busy} aria-label={text('exp.deleteAria', { title: row.title })} onClick={remove}>
                  {text('exp.delete')}
                </MBtn>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Expenses() {
  const { api, text, nameOf } = useBudget();
  const { paid, planned } = useMemo(() => expenseGroups(api.data.expenses ?? [], nameOf), [api.data.expenses]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {paid.length === 0 && planned.length === 0 && <p className="v5-note">{text('exp.empty')}</p>}
      {paid.length > 0 && (
        <>
          <Cap right={paid.length}>{text('exp.paidCap')}</Cap>
          <Grp>
            {paid.map((r) => (
              <ExpenseItem key={r.id} row={r} />
            ))}
          </Grp>
        </>
      )}
      {planned.length > 0 && (
        <>
          <Cap right={planned.length}>{text('exp.plannedCap')}</Cap>
          <Grp>
            {planned.map((r) => (
              <ExpenseItem key={r.id} row={r} />
            ))}
          </Grp>
        </>
      )}
      <Cap>{text('form.cap')}</Cap>
      <ExpenseForm />
    </>
  );
}

/* ---------- Qui doit quoi ---------- */

function Settle() {
  const { api, text, viewerId, budget, crew, money, nameOf } = useBudget();
  const view = settleView(crew.settlement, api.people, viewerId, budget.spent);
  const { planned } = useMemo(() => expenseGroups(api.data.expenses ?? [], nameOf), [api.data.expenses]); // eslint-disable-line react-hooks/exhaustive-deps
  const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n))}`;
  return (
    <>
      <Grp className="nb-card">
        <div className="v5-big">
          <b className="v5-num">{money(budget.spent)}</b>
          <span>{view.perPerson != null ? text('settle.big', { perPerson: money(view.perPerson) }) : text('settle.bigNone')}</span>
        </div>
      </Grp>

      <Cap right={view.counted > 0 ? text('settle.counted', { amount: money(view.counted) }) : undefined}>{text('settle.cap')}</Cap>
      {view.empty ? (
        <p className="v5-note">{text('settle.nothing')}</p>
      ) : (
        <Grp>
          {view.balanced ? (
            <Li icon="check" title={text('settle.balanced')} />
          ) : (
            view.debts.map((d) => (
              <div key={`${d.fromId}-${d.toId}`} className="v5-li">
                <span className="v5-avi nb-avi-s" aria-hidden="true">
                  {(d.fromName.trim()[0] ?? '?').toUpperCase()}
                </span>
                <span className="t">
                  <b>
                    {d.viewer === 'pays'
                      ? text('settle.debtYouPay', { amount: money(d.amount), to: d.toName })
                      : d.viewer === 'gets'
                        ? text('settle.debtYouGet', { amount: money(d.amount), from: d.fromName })
                        : text('settle.debt', { from: d.fromName, amount: money(d.amount), to: d.toName })}
                  </b>
                  <small>{text('settle.debtNote')}</small>
                </span>
              </div>
            ))
          )}
        </Grp>
      )}

      {view.balances.length > 0 && (
        <>
          <Cap>{text('settle.balancesCap')}</Cap>
          <Grp>
            {view.balances.map((b) => (
              <div key={b.userId} className="v5-li">
                <span className="v5-avi nb-avi-s" aria-hidden="true">
                  {(b.name.trim()[0] ?? '?').toUpperCase()}
                </span>
                <span className="t">
                  <b>{b.name}</b>
                  <small>{text('settle.balanceLine', { paid: money(b.paid), share: money(b.share) })}</small>
                </span>
                <span className="v v5-num">{signed(b.net)}</span>
              </div>
            ))}
          </Grp>
        </>
      )}

      {view.excludedCount > 0 && <p className="v5-note">{text.count(view.excludedCount, 'settle.excluded', { amount: money(view.excludedAmount) })}</p>}

      {planned.length > 0 && (
        <>
          <Cap right={planned.length}>{text('settle.plannedCap')}</Cap>
          <p className="v5-note">{text('settle.plannedNote')}</p>
          <Grp>
            {planned.map((r) => (
              <ExpenseItem key={r.id} row={r} compact />
            ))}
          </Grp>
        </>
      )}

      <p className="v5-note">{text('settle.never')}</p>
    </>
  );
}

const tabText = (api: V5Api): BudgetText => budgetText(api.t, api.locale);

export const budgetDrawer: V5DrawerDef = {
  space: 'budget',
  tabs: (api) => {
    const text = tabText(api);
    const all = { overview: { icon: 'pie', label: text('tabOverview') }, expenses: { icon: 'receipt', label: text('tabExpenses') }, settle: { icon: 'swap', label: text('tabSettle') } } as const;
    return budgetTabs(api.solo).map((id) => all[id]);
  },
  title: (api) => {
    const text = tabText(api);
    const tab = budgetTabAt(api.solo, api.tab);
    return tab === 'overview' ? text('titleOverview') : tab === 'expenses' ? text('tabExpenses') : text('tabSettle');
  },
  subtitle: (api) => {
    const total = budgetTotal(api.data.model.budget);
    if (total <= 0) return null;
    return tabText(api)('subPlanned', { amount: moneyIn(api.locale, total, api.data.model.budget.currency) });
  },
  Body: BudgetBody,
};
