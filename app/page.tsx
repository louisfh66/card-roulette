"use client";

import React, { useMemo, useState } from "react";

/* =======================
   Types
======================= */

type Suit = "hearts" | "diamonds" | "clubs" | "spades" | "joker";
type Color = "red" | "black" | "none";
type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "JOKER";

type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  color: Color;
  label: string;
};

type BetType = "RED_BLACK" | "SUIT" | "ROYAL" | "NUMBER_RANK" | "JOKER" | "EXACT_CARD";

type Bet =
  | { type: "RED_BLACK"; pick: "red" | "black" }
  | { type: "SUIT"; pick: Exclude<Suit, "joker"> }
  | { type: "ROYAL" }
  | { type: "NUMBER_RANK"; pick: Exclude<Rank, "JOKER"> }
  | { type: "JOKER" }
  | { type: "EXACT_CARD"; pick: { suit: Exclude<Suit, "joker">; rank: Exclude<Rank, "JOKER"> } };

type Round = {
  id: string;
  time: string;
  betText: string;
  stake: number;
  split: number;
  wins: number; // mixed board = 0 (not meaningful)
  returnMultiplier: number; // mixed board = 0
  payout: number;
  profit: number;
  drawn: string[];
};

type BoardBetKey =
  | "RED"
  | "BLACK"
  | "ROYAL"
  | "JOKER"
  | "SUIT_hearts"
  | "SUIT_diamonds"
  | "SUIT_clubs"
  | "SUIT_spades"
  | `RANK_${Exclude<Rank, "JOKER">}`
  | `EXACT_${Exclude<Rank, "JOKER">}_${Exclude<Suit, "joker">}`;

/* =======================
   Rules
======================= */

const RETURNS: Record<BetType, number> = {
  RED_BLACK: 2,
  SUIT: 4,
  ROYAL: 3.25,
  NUMBER_RANK: 10,
  JOKER: 20,
  EXACT_CARD: 50,
};

const CHIPS = [1, 5, 10, 25, 100];

const UI = {
  panelBg: "#f9fafb",
  panelBorder: "#e5e7eb",
  text: "#0f172a",
  muted: "#475569",
  soft: "#f3f4f6",
  buttonBorder: "#cbd5e1",
  cardBg: "#ffffff",
};


/* =======================
   Helpers
======================= */

function suitSymbol(suit: Suit) {
  switch (suit) {
    case "hearts":
      return "♥";
    case "diamonds":
      return "♦";
    case "clubs":
      return "♣";
    case "spades":
      return "♠";
    case "joker":
      return "🃏";
  }
}

function createDeck(): Card[] {
  const suits: Exclude<Suit, "joker">[] = ["hearts", "diamonds", "clubs", "spades"];
  const ranks: Exclude<Rank, "JOKER">[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  const deck: Card[] = [];
  for (const suit of suits) {
    const color: Color = suit === "hearts" || suit === "diamonds" ? "red" : "black";
    for (const rank of ranks) {
      deck.push({
        id: `${rank}-${suit}`,
        suit,
        rank,
        color,
        label: `${rank}${suitSymbol(suit)}`,
      });
    }
  }

  deck.push(
    { id: "JOKER-1", suit: "joker", rank: "JOKER", color: "none", label: `JOKER ${suitSymbol("joker")}` },
    { id: "JOKER-2", suit: "joker", rank: "JOKER", color: "none", label: `JOKER ${suitSymbol("joker")}` }
  );

  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isRoyal(card: Card) {
  return card.rank === "A" || card.rank === "K" || card.rank === "Q" || card.rank === "J";
}

function isWin(card: Card, bet: Bet): boolean {
  switch (bet.type) {
    case "RED_BLACK":
      return card.color === bet.pick;
    case "SUIT":
      return card.suit === bet.pick;
    case "ROYAL":
      return card.suit !== "joker" && isRoyal(card);
    case "NUMBER_RANK":
      return card.suit !== "joker" && card.rank === bet.pick;
    case "JOKER":
      return card.suit === "joker";
    case "EXACT_CARD":
      return card.suit === bet.pick.suit && card.rank === bet.pick.rank;
  }
}

function betFromBoardKey(key: BoardBetKey): Bet {
  if (key === "RED") return { type: "RED_BLACK", pick: "red" };
  if (key === "BLACK") return { type: "RED_BLACK", pick: "black" };
  if (key === "ROYAL") return { type: "ROYAL" };
  if (key === "JOKER") return { type: "JOKER" };

  if (key.startsWith("SUIT_")) {
    const suit = key.replace("SUIT_", "") as Exclude<Suit, "joker">;
    return { type: "SUIT", pick: suit };
  }

  if (key.startsWith("RANK_")) {
    const rank = key.replace("RANK_", "") as Exclude<Rank, "JOKER">;
    return { type: "NUMBER_RANK", pick: rank };
  }

  if (key.startsWith("EXACT_")) {
    const rest = key.replace("EXACT_", "");
    const [rank, suit] = rest.split("_") as [Exclude<Rank, "JOKER">, Exclude<Suit, "joker">];
    return { type: "EXACT_CARD", pick: { rank, suit } };
  }

  return { type: "ROYAL" };
}

function clampMoney(x: number) {
  return Math.round(x * 100) / 100;
}

/* =======================
   Page
======================= */

export default function Page() {
  const deck = useMemo(() => createDeck(), []);

  const [balance, setBalance] = useState<number>(100);
  const [split, setSplit] = useState<number>(1);

  const [selectedChip, setSelectedChip] = useState<number>(5);
  const [boardBets, setBoardBets] = useState<Partial<Record<BoardBetKey, number>>>({});

  // exact card picker
  const [exactRank, setExactRank] = useState<Exclude<Rank, "JOKER">>("A");
  const [exactSuit, setExactSuit] = useState<Exclude<Suit, "joker">>("hearts");

  const [lastDraw, setLastDraw] = useState<Card[] | null>(null);
  const [lastWins, setLastWins] = useState<number>(0);
  const [lastPayout, setLastPayout] = useState<number>(0);
  const [lastProfit, setLastProfit] = useState<number>(0);

  const [history, setHistory] = useState<Round[]>([]);

  // ✅ animation state
  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [isDealing, setIsDealing] = useState<boolean>(false);

  const ranks: Exclude<Rank, "JOKER">[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const suits: Exclude<Suit, "joker">[] = ["hearts", "diamonds", "clubs", "spades"];

  function boardTotal() {
    return Object.values(boardBets).reduce((a, b) => a + (b ?? 0), 0);
  }

  function placeBoardChip(key: BoardBetKey) {
    if (balance < selectedChip || isDealing) return;
    setBoardBets((prev) => ({ ...prev, [key]: clampMoney((prev[key] ?? 0) + selectedChip) }));
    setBalance((b) => clampMoney(b - selectedChip));
  }

  function clearBoardRefund() {
    if (isDealing) return;
    setBalance((b) => clampMoney(b + boardTotal()));
    setBoardBets({});
  }

  function placeExactCard() {
    const key = `EXACT_${exactRank}_${exactSuit}` as BoardBetKey;
    placeBoardChip(key);
  }

  function reset() {
    if (isDealing) return;

    // refund board
    setBalance((b) => clampMoney(b + boardTotal()));
    setBoardBets({});

    // hard reset
    setBalance(100);
    setSelectedChip(5);

    setLastDraw(null);
    setLastWins(0);
    setLastPayout(0);
    setLastProfit(0);
    setHistory([]);

    // reset animation
    setRevealedCount(0);
    setIsDealing(false);
  }

  // ✅ reveal helper
  function startReveal(count: number) {
    setIsDealing(true);
    setRevealedCount(0);

    for (let i = 1; i <= count; i++) {
      window.setTimeout(() => {
        setRevealedCount(i);
        if (i === count) setIsDealing(false);
      }, 120 * i); // tweak speed here
    }
  }

  function playRound() {
    if (isDealing) return;

    const N = Math.max(1, Math.min(54, Math.floor(split || 1)));
    const keys = Object.keys(boardBets) as BoardBetKey[];
    if (keys.length === 0) return;

    const drawn = shuffle(deck).slice(0, N);

    const stakeTotal = boardTotal();
    let totalPayout = 0;

    for (const key of keys) {
      const amount = boardBets[key] ?? 0;
      if (!amount) continue;

      const bet = betFromBoardKey(key);
      const ret = RETURNS[bet.type];
      const wins = drawn.reduce((acc, c) => acc + (isWin(c, bet) ? 1 : 0), 0);

      totalPayout += amount * ret * (wins / N);
    }

    setBalance((b) => clampMoney(b + totalPayout));

    setLastDraw(drawn);
    startReveal(drawn.length);

    setLastWins(0);
    setLastPayout(clampMoney(totalPayout));
    setLastProfit(clampMoney(totalPayout - stakeTotal));

    const now = new Date();
    const betSummary = keys
      .map((k) => `${k.replaceAll("_", " ")} £${(boardBets[k] ?? 0).toFixed(2)}`)
      .join(" • ");

    setHistory((h) =>
      [
        {
          id: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
          time: now.toLocaleTimeString(),
          betText: betSummary,
          stake: stakeTotal,
          split: N,
          wins: 0,
          returnMultiplier: 0,
          payout: clampMoney(totalPayout),
          profit: clampMoney(totalPayout - stakeTotal),
          drawn: drawn.map((c) => c.label),
        },
        ...h,
      ].slice(0, 25)
    );

    // clear board after deal (no refund)
    setBoardBets({});
  }

  const canPlay = boardTotal() > 0 && !isDealing;
  const START_BALANCE = 100;
const sessionPL = clampMoney(balance - START_BALANCE);


  return (
    // ✅ Casino background wrapper
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top, #1f2933 0%, #0f172a 70%)",
        padding: 20,
        fontFamily: "system-ui, Arial",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 6, color: "#f8fafc" }}>Card Roulette</h1>

        <style jsx global>{`
          button {
  background-color: ${UI.soft};
  color: ${UI.text};
  border: 1px solid ${UI.buttonBorder};
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}


          /* ✅ Deal animation */
          .card {
            transform: perspective(800px) rotateY(90deg) translateY(6px);
            opacity: 0;
            transition: transform 260ms ease, opacity 260ms ease, box-shadow 260ms ease;
            will-change: transform, opacity;
          }

          .card.revealed {
            transform: perspective(800px) rotateY(0deg) translateY(0px);
            opacity: 1;
          }

          /* subtle casino highlights */
          .card.jokerGlow {
            box-shadow: 0 0 0 2px rgba(6, 95, 70, 0.18);
          }
          .card.royalGlow {
            box-shadow: 0 0 0 2px rgba(161, 98, 7, 0.18);
          }
        `}</style>

        <p style={{ marginTop: 0, color: "#cbd5e1" }}>
          54-card deck (52 + 2 jokers). Split draws N cards. Payout scales with wins.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
          {/* Left */}
          <div
            style={{
              backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 16,
              boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, color: "#475569" }}>Balance</div>
<div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>£{balance.toFixed(2)}</div>
<div style={{ marginTop: 6, fontSize: 13, fontWeight: 900, color: sessionPL >= 0 ? "#065f46" : "#7f1d1d" }}>
  Session Balance: {sessionPL >= 0 ? "+" : "-"}£{Math.abs(sessionPL).toFixed(2)}
</div>


              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
                <button
                  onClick={reset}
                  disabled={isDealing}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #bbb",
                    backgroundColor: "#f3f4f6",
                    fontWeight: 800,
                    cursor: isDealing ? "not-allowed" : "pointer",
                  }}
                >
                  Reset
                </button>

                <button
                  onClick={playRound}
                  disabled={!canPlay}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "none",
                    backgroundColor: canPlay ? "#16a34a" : "#9ca3af",
                    color: "#fff",
                    cursor: canPlay ? "pointer" : "not-allowed",
                    fontWeight: 900,
                  }}
                >
                  {isDealing ? "Dealing..." : "Deal"}
                </button>
              </div>
            </div>

            {/* Chips */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>Chips</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setSelectedChip(chip)}
                    disabled={isDealing}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "999px",
                      border: "2px solid #222",
                      fontWeight: 900,
                      backgroundColor: selectedChip === chip ? "#222" : "#f5f5f5",
                      color: selectedChip === chip ? "#fff" : "#111",
                      cursor: isDealing ? "not-allowed" : "pointer",
                    }}
                  >
                    £{chip}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10 }}>
                <div>
                 <div style={{ fontSize: 12, color: "#475569" }}>Total placed</div>
<div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>£{boardTotal().toFixed(2)}</div>

                </div>

                <button
                  onClick={clearBoardRefund}
                  disabled={boardTotal() === 0 || isDealing}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #bbb",
                    backgroundColor: "#f3f4f6",
                    fontWeight: 800,
                    cursor: boardTotal() === 0 || isDealing ? "not-allowed" : "pointer",
                  }}
                >
                  Clear board (refund)
                </button>
              </div>
            </div>

            <hr style={{ margin: "16px 0", borderColor: "#e5e7eb", opacity: 0.6 }} />

            {/* Board */}
            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 10 }}>
                Bet board (click to place £{selectedChip})
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {(
                  [
                    { key: "RED", label: "RED", sub: "2×" },
                    { key: "BLACK", label: "BLACK", sub: "2×" },
                    { key: "ROYAL", label: "ROYAL", sub: "3.25×" },
                    { key: "SUIT_hearts", label: "♥ Hearts", sub: "4×" },
                    { key: "SUIT_diamonds", label: "♦ Diamonds", sub: "4×" },
                    { key: "SUIT_clubs", label: "♣ Clubs", sub: "4×" },
                    { key: "SUIT_spades", label: "♠ Spades", sub: "4×" },
                    { key: "JOKER", label: "🃏 Jokers", sub: "20×" },
                  ] as const
                ).map((b) => {
                  const amt = boardBets[b.key as BoardBetKey] ?? 0;
                  return (
                    <button
                      key={b.key}
                      onClick={() => placeBoardChip(b.key as BoardBetKey)}
                      disabled={isDealing}
                      style={{
                        textAlign: "left",
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid #bbb",
                        backgroundColor: amt > 0 ? "#eef2ff" : "#fafafa",
                        color: "#111",
                        cursor: isDealing ? "not-allowed" : "pointer",
                      }}
                      title={`Placed £${amt.toFixed(2)}`}
                    >
                      <div style={{ fontWeight: 900 }}>{b.label}</div>
                      <div style={{ fontSize: 12, color: "#475569" }}>{b.sub}</div>
                      <div style={{ marginTop: 6, fontSize: 12 }}>
                        Placed: <b>£{amt.toFixed(2)}</b>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Rank strip */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>Number (rank) — 10×</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ranks.map((r) => {
                    const key = `RANK_${r}` as BoardBetKey;
                    const amt = boardBets[key] ?? 0;
                    return (
                      <button
                        key={r}
                        onClick={() => placeBoardChip(key)}
                        disabled={isDealing}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #bbb",
                          backgroundColor: amt > 0 ? "#eef2ff" : "#fafafa",
                          color: "#111",
                          fontWeight: 900,
                          cursor: isDealing ? "not-allowed" : "pointer",
                        }}
                        title={`Placed £${amt.toFixed(2)}`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Exact card */}
              <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Exact card — 50×</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label>
                    <div style={{ fontSize: 12, color: "#475569" }}>Rank</div>
                    <select
                      value={exactRank}
                      onChange={(e) => setExactRank(e.target.value as any)}
                      disabled={isDealing}
                      style={{
                        width: "100%",
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid #ccc",
                        backgroundColor: "#fff",
                        color: "#111",
                      }}
                    >
                      {ranks.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <div style={{ fontSize: 12, color: "#475569" }}>Suit</div>
                    <select
                      value={exactSuit}
                      onChange={(e) => setExactSuit(e.target.value as any)}
                      disabled={isDealing}
                      style={{
                        width: "100%",
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid #ccc",
                        backgroundColor: "#fff",
                        color: "#111",
                      }}
                    >
                      {suits.map((s) => (
                        <option key={s} value={s}>
                          {s} {suitSymbol(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <button
                  onClick={placeExactCard}
                  disabled={isDealing}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #bbb",
                    backgroundColor: "#f3f4f6",
                    color: "#111",
                    fontWeight: 900,
                    cursor: isDealing ? "not-allowed" : "pointer",
                  }}
                >
                  Place exact: {exactRank}
                  {suitSymbol(exactSuit)} (adds £{selectedChip})
                </button>

                <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>
                  Click “Place exact” repeatedly to stack chips on the same exact-card bet.
                </div>
              </div>
            </div>

            <hr style={{ margin: "16px 0", borderColor: "#e5e7eb", opacity: 0.6 }} />

            {/* Split */}
            <label>
              <div style={{ fontSize: 12, color: "#475569" }}>Split (cards drawn)</div>
              <input
                type="number"
                min={1}
                max={54}
                step={1}
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
                disabled={isDealing}
                style={{
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  backgroundColor: "#fff",
  color: "#0f172a",
  fontWeight: 800,
}}

              />
            </label>

            <div style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
              Payout formula per bet: <b>stake × return × (wins / split)</b>
            </div>
          </div>

          {/* Right */}
          <div
            style={{
              backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 16,
              boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18, color: "#0f172a" }}>Last round</h2>


            {lastDraw ? (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {lastDraw.map((c, idx) => {
                    const revealed = idx < revealedCount;

                    const isJoker = c.suit === "joker";
                    const isRoyalCard =
                      !isJoker && (c.rank === "A" || c.rank === "K" || c.rank === "Q" || c.rank === "J");

                    return (
                      <div
                        key={c.id}
                        className={[
                          "card",
                          revealed ? "revealed" : "",
                          isJoker ? "jokerGlow" : "",
                          isRoyalCard ? "royalGlow" : "",
                        ].join(" ")}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid #ccc",
                          minWidth: 80,
                          textAlign: "center",
                          fontWeight: 800,
                          backgroundColor: "#fafafa",
                          color: isJoker ? "#065f46" : c.color === "red" ? "#7f1d1d" : "#111827",
                        }}
                        title={`${c.rank} of ${c.suit}`}
                      >
                        <div style={{ fontSize: 18 }}>{c.label}</div>
                        <div style={{ fontSize: 12, color: "#475569" }}>{isJoker ? "joker" : c.color}</div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                    <div style={{ fontSize: 12, color: "#475569" }}>Split</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{split}</div>
                  </div>
                  <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                    <div style={{ fontSize: 12, color: "#475569" }}>Payout</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>£{lastPayout.toFixed(2)}</div>
                  </div>
                  <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                    <div style={{ fontSize: 12, color: "#475569" }}>Profit</div>
                    <div
  style={{
    fontSize: 20,
    fontWeight: 900,
    color: lastProfit >= 0 ? "#065f46" : "#7f1d1d", // casino green / deep red
  }}
>
  {lastProfit >= 0 ? "+" : "-"}£{Math.abs(lastProfit).toFixed(2)}
</div>

                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: "#64748b" }}>Place chips on the board, then press <b>Deal</b>.</div>
            )}

            <hr style={{ margin: "16px 0", borderColor: "#e5e7eb", opacity: 0.6 }} />

            <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18, color: "#0f172a" }}>
History</h2>
            {history.length === 0 ? (
              <div style={{ color: "#475569" }}>No rounds yet.</div>

            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {history.map((r) => (
                  <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                     <div style={{ fontWeight: 950, color: "#0f172a" }}>{r.betText}</div>
                      <div style={{ fontSize: 12, color: "#475569" }}>{r.time}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>
                      Stake £{r.stake.toFixed(2)} • Split {r.split}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 6, color: "#0f172a" }}>
  Payout{" "}
  <b style={{ color: "#0f172a" }}>£{r.payout.toFixed(2)}</b> • Profit{" "}
  <b style={{ color: r.profit >= 0 ? "#065f46" : "#7f1d1d" }}>
    {r.profit >= 0 ? "+" : "-"}£{Math.abs(r.profit).toFixed(2)}
  </b>
</div>

                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Drawn: {r.drawn.join(", ")}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 18, fontSize: 12, color: "#475569" }}>
          Note: “Return” is total payout including stake (roulette-style). Jokers are neither red nor black and have no suit.
        </div>
      </div>
    </div>
  );
}
