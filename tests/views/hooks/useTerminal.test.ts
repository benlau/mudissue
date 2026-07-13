import { jest } from "@jest/globals";
import { useTerminalSizeStore } from "../../../src/views/hooks/useTerminal.ts";

describe("useTerminalSizeStore", () => {
  beforeEach(() => {
    useTerminalSizeStore.setState({
      cols: 80,
      rows: 24,
      syncGeneration: 0,
    });
  });

  it("increments syncGeneration when syncFromTerminal runs", () => {
    useTerminalSizeStore.getState().syncFromTerminal();
    expect(useTerminalSizeStore.getState().syncGeneration).toBe(1);
  });
});
