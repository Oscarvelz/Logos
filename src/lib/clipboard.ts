/** Read the clipboard: through the Logos Android app when inside it (WebView blocks clipboard-read), else the browser API. */
export async function readClipboard(): Promise<string> {
  const droid = (window as unknown as { LogosAndroid?: { clipboard?: () => string } }).LogosAndroid
  if (droid?.clipboard) return droid.clipboard() ?? ''
  return navigator.clipboard.readText()
}
