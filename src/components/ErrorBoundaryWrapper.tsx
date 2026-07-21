'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundaryWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: false };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundaryWrapper caught:', error);
  }

  render() {
    return this.props.children;
  }
}
