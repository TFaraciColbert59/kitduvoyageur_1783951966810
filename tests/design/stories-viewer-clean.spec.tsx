// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StoriesViewer, { type StoryUser } from '@/components/communaute/StoriesViewer';

afterEach(() => cleanup());

const USER: StoryUser = {
  id: 'author',
  name: 'Léa Martin',
  avatarUrl: 'https://example.com/lea.jpg',
  time: 'il y a 2 h',
  slides: [
    {
      image: 'https://example.com/story.jpg',
      storyId: 'story-1',
      caption: 'Un texte de story',
      replyPolicy: 'everyone',
    },
  ],
};

describe('StoriesViewer — version épurée', () => {
  it('ne laisse que la pillule auteur et l’envoi de message', () => {
    render(
      <StoriesViewer
        users={[USER]}
        startUser={0}
        myUserId="me"
        onClose={vi.fn()}
        onReply={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByText('Léa Martin')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Léa Martin/ }).getAttribute('href')).toBe('/profil/author');
    expect(document.querySelector('.lkdv-post-author')).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Options de la story' })).toBeTruthy();
    expect(screen.getByLabelText('Aimer cette story')).toBeTruthy();
    expect(screen.getByLabelText('Envoyer la réponse')).toBeTruthy();
    expect(screen.queryByLabelText(/Fermer les stories/)).toBeNull();
    expect(screen.queryByText('Un texte de story')).toBeNull();
  });

  it('envoie le message lié à la story', async () => {
    const onReply = vi.fn().mockResolvedValue(true);
    render(
      <StoriesViewer
        users={[USER]}
        startUser={0}
        myUserId="me"
        onClose={vi.fn()}
        onReply={onReply}
      />,
    );

    const input = screen.getByLabelText('Répondre à Léa Martin');
    fireEvent.change(input, { target: { value: 'Super story' } });
    fireEvent.click(screen.getByLabelText('Envoyer la réponse'));
    await vi.waitFor(() => expect(onReply).toHaveBeenCalledWith(USER.slides[0], USER, 'Super story'));
  });
});
