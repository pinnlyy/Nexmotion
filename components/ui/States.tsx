'use client';
import { useEffect, useState } from 'react';

export function Loading({ text }: { text?: string }) {
  return (
    <div className="loading-block">
      <div className="spinner" />
      <div style={{ marginTop: 12 }}>{text || 'Loading…'}</div>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="empty">◌ {text}</div>;
}

export function ErrorState({ text }: { text: string }) {
  return <div className="error-state">✕ {text}</div>;
}
