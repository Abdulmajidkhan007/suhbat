import { createConnectionKeeper } from './connectionKeeper';

describe('createConnectionKeeper', () => {
  it('oxirgi egasi qo\'yib yuborganda uziladi; ikki marta qo\'yib yuborish e\'tiborsiz', () => {
    const socket = { connect: jest.fn(), disconnect: jest.fn() };
    const keeper = createConnectionKeeper(socket);
    const a = keeper.hold();
    const b = keeper.hold();
    expect(socket.connect).toHaveBeenCalledTimes(2);
    a();
    a();
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(keeper.held).toBe(true);
    b();
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(keeper.held).toBe(false);
  });
});
