/**
 * @jest-environment jsdom
 */
import { jest } from "@jest/globals";
import { act, cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import {
  useSearchingDialogHandle,
  type SearchingDialogResponse,
} from "../../../src/views/components/SearchingDialog.tsx";
import { MUDISSUE_STATE_URL } from "../../../src/constants.ts";
import { MudissueStateKey } from "../../../src/types/registry.ts";
import { createMockSystemContext } from "../../fixture/MockSystemContext.tsx";
import type { RegistryService } from "../../../src/services/RegistryService.ts";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import { PopupNames, usePopupStore } from "../../../src/store/PopupStore.ts";

describe("SearchingDialog handle", () => {
  let registryService: jest.Mocked<RegistryService>;

  beforeEach(() => {
    resetAppStore();
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
    const bundle = createMockSystemContext();
    registryService = bundle.registryService;
    registryService.get.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    act(() => {
      resetAppStore();
      usePopupStore.setState({
        popupStack: [],
        hasPopup: false,
        latestPopup: null,
      });
    });
  });

  it("opens with empty text when no active search and no history", async () => {
    let handle: ReturnType<typeof useSearchingDialogHandle> | null = null;
    function Consumer() {
      handle = useSearchingDialogHandle();
      return null;
    }
    await act(async () => {
      render(createElement(Consumer));
    });
    let openPromise: Promise<SearchingDialogResponse>;
    const keyBefore = handle!.props.dialogInputKey;
    await act(async () => {
      openPromise = handle!.methods.open({
        initialValue: "",
      });
    });
    expect(handle!.props.value).toBe("");
    expect(handle!.props.dialogRecentFilters).toEqual([]);
    expect(handle!.props.dialogInputInitialValue).toBeUndefined();
    expect(handle!.props.dialogInputKey).toBe(keyBefore + 1);
    expect(usePopupStore.getState().latestPopup).toBe(
      PopupNames.SearchingDialog,
    );
    await act(async () => {
      handle!.props.close();
    });
    await openPromise;
    expect(usePopupStore.getState().hasPopup).toBe(false);
  });

  it("opens with latest history when search is active and history exists", async () => {
    registryService.get.mockResolvedValue({
      url: MUDISSUE_STATE_URL,
      value: JSON.stringify(["newest", "older"]),
    });
    let handle: ReturnType<typeof useSearchingDialogHandle> | null = null;
    function Consumer() {
      handle = useSearchingDialogHandle();
      return null;
    }
    await act(async () => {
      render(createElement(Consumer));
    });
    let openPromise: Promise<SearchingDialogResponse>;
    await act(async () => {
      openPromise = handle!.methods.open({
        initialValue: "status:open",
      });
    });
    expect(handle!.props.value).toBe("newest");
    expect(handle!.props.dialogRecentFilters).toEqual(["newest", "older"]);
    expect(handle!.props.dialogInputInitialValue).toBeUndefined();
    await act(async () => {
      handle!.props.close();
    });
    await openPromise;
  });

  it("keeps current filter text when search active but history is empty", async () => {
    let handle: ReturnType<typeof useSearchingDialogHandle> | null = null;
    function Consumer() {
      handle = useSearchingDialogHandle();
      return null;
    }
    await act(async () => {
      render(createElement(Consumer));
    });
    let openPromise: Promise<SearchingDialogResponse>;
    await act(async () => {
      openPromise = handle!.methods.open({
        initialValue: "status:open",
      });
    });
    expect(handle!.props.value).toBe("status:open");
    expect(handle!.props.dialogRecentFilters).toEqual([]);
    expect(handle!.props.dialogInputInitialValue).toBe("status:open");
    await act(async () => {
      handle!.props.close();
    });
    await openPromise;
  });

  it("opens with blank scratch when history exists but search is inactive", async () => {
    registryService.get.mockResolvedValue({
      url: MUDISSUE_STATE_URL,
      value: JSON.stringify(["a", "b", "c"]),
    });
    let handle: ReturnType<typeof useSearchingDialogHandle> | null = null;
    function Consumer() {
      handle = useSearchingDialogHandle();
      return null;
    }
    await act(async () => {
      render(createElement(Consumer));
    });
    let openPromise: Promise<SearchingDialogResponse>;
    await act(async () => {
      openPromise = handle!.methods.open({
        initialValue: "",
      });
    });
    expect(handle!.props.value).toBe("");
    expect(handle!.props.dialogRecentFilters).toEqual(["a", "b", "c"]);
    expect(handle!.props.dialogInputInitialValue).toBe("");
    await act(async () => {
      handle!.props.close();
    });
    await openPromise;
  });

  it("loads registry recent filters on open", async () => {
    registryService.get.mockResolvedValue({
      url: MUDISSUE_STATE_URL,
      value: JSON.stringify(["a"]),
    });
    let handle: ReturnType<typeof useSearchingDialogHandle> | null = null;
    function Consumer() {
      handle = useSearchingDialogHandle();
      return null;
    }
    await act(async () => {
      render(createElement(Consumer));
    });
    let openPromise: Promise<SearchingDialogResponse>;
    await act(async () => {
      openPromise = handle!.methods.open({ initialValue: "" });
    });
    expect(registryService.get).toHaveBeenCalledWith(
      MUDISSUE_STATE_URL,
      "system",
      MudissueStateKey.RecentFiltersKey,
    );
    await act(async () => {
      handle!.props.close();
    });
    await openPromise;
  });
});
