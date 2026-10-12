import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { ErrorBoundary } from './ErrorBoundary';

let shouldThrow = true;
const Bomb = () => {
  if (shouldThrow) throw new Error('portladi');
  return <Text>ishlayapti</Text>;
};

const Toggle = () => {
  const [n, setN] = useState(0);
  return <Pressable onPress={() => setN(n + 1)}><Text>{n}</Text></Pressable>;
};

describe('ErrorBoundary (crash ekrani)', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('render xatosida crash ekrani, "Qayta urinish" bilan tiklanadi', async () => {
    shouldThrow = true;
    const onError = jest.fn();
    await render(<ErrorBoundary onError={onError}><Bomb /></ErrorBoundary>);
    expect(screen.getByText('Nimadir noto\'g\'ri ketdi')).toBeTruthy();
    expect(screen.getByText('portladi')).toBeTruthy();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'portladi' }), expect.anything());

    shouldThrow = false;
    await fireEvent.press(screen.getByText('Qayta urinish'));
    expect(screen.getByText('ishlayapti')).toBeTruthy();
  });

  it('xato bo\'lmasa bolalarni o\'zgarishsiz ko\'rsatadi', async () => {
    await render(<ErrorBoundary><Toggle /></ErrorBoundary>);
    await fireEvent.press(screen.getByText('0'));
    expect(screen.getByText('1')).toBeTruthy();
  });
});
