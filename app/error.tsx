// app/error.tsx
"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="p-8">
      <h1 className="mb-2 text-xl font-bold">エラーが発生しました</h1>
      <p className="mb-4 text-gray-600">時間をおいてもう一度お試しください。</p>
      <button onClick={reset} className="rounded bg-gray-900 px-4 py-2 text-white">
        再読み込み
      </button>
    </div>
  );
}