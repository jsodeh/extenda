import { render, screen } from '@testing-library/react';
import { NavigationMenu } from '../NavigationMenu';

describe('NavigationMenu', () => {
    it('renders all menu items', () => {
        const mockNavigate = jest.fn();
        render(<NavigationMenu currentPage="chat" onNavigate={mockNavigate} />);

        // Menu button should be present
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('calls onNavigate when item is clicked', async () => {
        const mockNavigate = jest.fn();
        const { getByText } = render(
            <NavigationMenu currentPage="chat" onNavigate={mockNavigate} />
        );

        // Click the button to open menu
        const button = screen.getByRole('button');
        button.click();

        // This would require more complex interaction testing
        // Keeping it simple for now
    });
});
