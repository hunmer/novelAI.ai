'use client';

import * as React from 'react';
import { FloatingLoggerButton } from './floating-logger-button';
import { LoggerDrawer } from './logger-drawer';

export function LoggerWidget() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <FloatingLoggerButton onClick={() => setOpen(true)} />
      <LoggerDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
