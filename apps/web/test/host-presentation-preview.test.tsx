import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HostPresentationPreview } from '../components/host-presentation-preview';
import { privateInvitation, publicLanding } from './public-experience-fixture';

describe('protected host presentation preview', () => {
  it('switches experience and viewport without calling public lookup', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    render(
      <HostPresentationPreview
        identifier="raymundo-6"
        preview={{ landing: publicLanding, invitation: privateInvitation }}
      />,
    );
    expect(screen.getAllByText(/Protected host preview/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Open my invitation' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Private invitation' }));
    expect(screen.getByRole('heading', { name: 'Raymundo' })).toBeInTheDocument();
    expect(screen.queryByText('Family Sample')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open invitation' }));
    expect(screen.getByText('Family Sample')).toBeInTheDocument();
    expect(playSpy).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Open invitation' }));
    expect(screen.getByRole('button', { name: "Yes, we'll be there" })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Tablet' }));
    expect(screen.getByTestId('preview-viewport')).toHaveAttribute('data-viewport', 'tablet');
    expect(fetchSpy).not.toHaveBeenCalled();
    playSpy.mockRestore();
    fetchSpy.mockRestore();
  });
});
