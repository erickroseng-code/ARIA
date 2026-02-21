import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AudioRecorder } from '../AudioRecorder';

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  stream: {
    getTracks: vi.fn(() => [{ stop: vi.fn() }]),
  },
};

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: mockGetUserMedia,
    },
    writable: true,
  });

  Object.defineProperty(window, 'MediaRecorder', {
    value: vi.fn(() => mockMediaRecorder),
    writable: true,
  });

  mockGetUserMedia.mockResolvedValue({});
});

describe('AudioRecorder', () => {
  it('should render record button', () => {
    render(<AudioRecorder onTranscription={() => {}} />);
    expect(screen.getByText(/Gravar/i)).toBeDefined();
  });

  it('should start recording when button is clicked', async () => {
    render(<AudioRecorder onTranscription={() => {}} />);
    const recordBtn = screen.getByText(/Gravar/i);

    fireEvent.click(recordBtn);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    });
  });

  it('should show stop button while recording', async () => {
    render(<AudioRecorder onTranscription={() => {}} />);
    const recordBtn = screen.getByText(/Gravar/i);

    fireEvent.click(recordBtn);

    await waitFor(() => {
      expect(screen.getByText(/Parar/i)).toBeDefined();
    });
  });

  it('should stop recording when stop button is clicked', async () => {
    render(<AudioRecorder onTranscription={() => {}} />);
    const recordBtn = screen.getByText(/Gravar/i);

    fireEvent.click(recordBtn);

    await waitFor(() => {
      const stopBtn = screen.getByText(/Parar/i);
      fireEvent.click(stopBtn);
    });

    expect(mockMediaRecorder.stop).toHaveBeenCalled();
  });

  it('should handle microphone access error', async () => {
    const onError = vi.fn();
    mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));

    render(<AudioRecorder onTranscription={() => {}} onError={onError} />);
    const recordBtn = screen.getByText(/Gravar/i);

    fireEvent.click(recordBtn);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Permission denied');
    });
  });

  it('should be disabled when disabled prop is true', () => {
    render(<AudioRecorder onTranscription={() => {}} disabled={true} />);
    const recordBtn = screen.getByText(/Gravar/i) as HTMLButtonElement;

    expect(recordBtn.disabled).toBe(true);
  });

  it('should handle transcription API error', async () => {
    const onError = vi.fn();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'API Error' }),
    });

    render(<AudioRecorder onTranscription={() => {}} onError={onError} />);
    const recordBtn = screen.getByText(/Gravar/i);

    fireEvent.click(recordBtn);

    // Simulate recording stopped
    const mediaRecorder = (window.MediaRecorder as any)();
    mediaRecorder.onstop();

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });

  it('should call onTranscription with transcribed text', async () => {
    const onTranscription = vi.fn();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: 'Hello world' }),
    });

    render(<AudioRecorder onTranscription={onTranscription} />);
    const recordBtn = screen.getByText(/Gravar/i);

    fireEvent.click(recordBtn);

    // Simulate recording stopped
    const mediaRecorder = (window.MediaRecorder as any)();
    mediaRecorder.onstop();

    await waitFor(() => {
      expect(onTranscription).toHaveBeenCalledWith('Hello world');
    });
  });

  it('should send correct data to API', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: 'test' }),
    });

    render(<AudioRecorder onTranscription={() => {}} />);
    const recordBtn = screen.getByText(/Gravar/i);

    fireEvent.click(recordBtn);

    // Simulate recording stopped
    const mediaRecorder = (window.MediaRecorder as any)();
    mediaRecorder.onstop();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/audio/transcribe',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });
  });
});
