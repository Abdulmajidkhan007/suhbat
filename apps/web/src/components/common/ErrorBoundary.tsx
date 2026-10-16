import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';

interface Props   { children: React.ReactNode; fallback?: React.ReactNode }
interface State   { hasError: boolean; error: Error | null }

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <Box
          className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6"
          sx={{ bgcolor: 'background.default' }}
        >
          <BugReportOutlinedIcon sx={{ fontSize: 56, opacity: 0.3 }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Nimadir xato ketdi
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
            Kutilmagan xatolik yuz berdi. Sahifani qayta yuklab ko'ring.
            {/* Texnik tafsilot faqat ishlab chiqishda (foydalanuvchiga inglizcha stack ko'rinmasin). */}
            {import.meta.env.DEV && this.state.error ? ` (${this.state.error.message})` : null}
          </Typography>
          <Button
            variant="contained"
            onClick={this.handleReset}
            sx={{ borderRadius: '10px', mt: 1 }}
          >
            Qayta urinish
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
