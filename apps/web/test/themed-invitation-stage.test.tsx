import { fireEvent, render, screen } from '@testing-library/react';
import { getDictionary } from '@matemyparty/i18n';
import { describe, expect, it } from 'vitest';
import { ThemedInvitationStage } from '../components/themed-invitation-stage';
import { presentation } from './public-experience-fixture';

describe('ThemedInvitationStage', () => {
  it('prefers the static fallback and skips animation for reduced motion', () => {
    const { container } = render(
      <ThemedInvitationStage
        presentation={presentation}
        dictionary={getDictionary('en-US')}
        forceReducedMotion
      >
        <p>Invitation details remain available</p>
      </ThemedInvitationStage>,
    );
    expect(screen.queryByTestId('invitation-video')).not.toBeInTheDocument();
    expect(screen.getByTestId('media-fallback').querySelector('img')).toHaveAttribute(
      'src',
      presentation.staticFallbackRef,
    );
    expect(container.querySelector('.celebration-flight')).not.toBeInTheDocument();
    expect(screen.getByText('Invitation details remain available')).toBeInTheDocument();
  });

  it('falls back to the configured image when video loading fails', () => {
    render(
      <ThemedInvitationStage presentation={presentation} dictionary={getDictionary('en-US')}>
        <p>Invitation</p>
      </ThemedInvitationStage>,
    );
    fireEvent.error(screen.getByTestId('invitation-video'));
    expect(screen.queryByTestId('invitation-video')).not.toBeInTheDocument();
    expect(screen.getByTestId('media-fallback')).toBeInTheDocument();
  });

  it.each(['NIGHT_DRAGON_FLIGHT', 'ADVENTURE_GATES', 'ENVELOPE_REVEAL', 'WINTER_SNOW'] as const)(
    'renders the configuration-driven %s mode',
    (mode) => {
      const { container } = render(
        <ThemedInvitationStage
          presentation={{ ...presentation, mode, videoRef: null, audioRef: null }}
          dictionary={getDictionary('en-US')}
        >
          <p>Invitation</p>
        </ThemedInvitationStage>,
      );
      expect(container.querySelector(`[data-presentation-mode="${mode}"]`)).toBeInTheDocument();
    },
  );
});
