import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import i18n from '@/i18n';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { I18nextProvider } from 'react-i18next';

function renderSwitcher() {
  return render(
    <I18nextProvider i18n={i18n}>
      <LanguageSwitcher />
    </I18nextProvider>,
  );
}

describe('LanguageSwitcher', () => {
  it('switches from EN to DE and back', async () => {
    await i18n.changeLanguage('en');
    renderSwitcher();
    const btn = screen.getByRole('button', { name: /switch language/i });
    expect(btn).toHaveTextContent('DE');
    await userEvent.click(btn);
    expect(i18n.language).toBe('de');
    await userEvent.click(btn);
    expect(i18n.language).toBe('en');
  });
});
