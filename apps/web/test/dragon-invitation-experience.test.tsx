import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DragonInvitationExperience } from '../components/dragon-invitation-experience';

const labels = {
  enter: 'Enter the Dragon World',
  fallback: 'Night Fury signal detected',
  introPrompt: 'A Night Fury awaits',
  video: 'Invitation media controls',
  play: 'Play',
  pause: 'Pause',
  mute: 'Mute',
  soundOn: 'Sound on',
};

function renderExperience() {
  return render(
    <DragonInvitationExperience labels={labels}>
      <h1>Birthday details</h1>
    </DragonInvitationExperience>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('dragon invitation media', () => {
  it('waits for interaction and exposes play, pause, and mute controls', async () => {
    const attemptedTags: string[] = [];
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      attemptedTags.push(this.tagName);
      return Promise.resolve();
    });
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const { container } = renderExperience();

    expect(play).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: labels.enter }));

    expect(play).toHaveBeenCalledTimes(1);
    expect(attemptedTags).toEqual(['VIDEO']);
    expect(screen.getByRole('heading', { name: 'Birthday details' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: labels.pause }));
    expect(pause).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: labels.mute }));
    expect(container.querySelector('video')).toHaveProperty('muted', true);
    expect(container.querySelector('audio')).toHaveProperty('muted', true);
  });

  it('shows the animated fallback and attempts fallback audio when video playback fails', async () => {
    const attemptedTags: string[] = [];
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      attemptedTags.push(this.tagName);
      return this.tagName === 'VIDEO'
        ? Promise.reject(new Error('video unavailable'))
        : Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderExperience();

    await user.click(screen.getByRole('button', { name: labels.enter }));

    expect(attemptedTags).toEqual(['VIDEO', 'AUDIO']);
    expect(screen.getByLabelText(labels.fallback)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: labels.pause })).toBeInTheDocument();
  });

  it('skips video for reduced motion while keeping the static fallback usable', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const attemptedTags: string[] = [];
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      attemptedTags.push(this.tagName);
      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderExperience();

    await user.click(screen.getByRole('button', { name: labels.enter }));

    expect(attemptedTags).toEqual(['AUDIO']);
    expect(screen.getByLabelText(labels.fallback)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Birthday details' })).toBeInTheDocument();
  });
});
