// 大數字格式化：後期傷害/血量會滾到千萬甚至億，跳字與面板都用這個。
export function fmtNum(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e8) return (n / 1e8).toFixed(abs >= 1e9 ? 0 : 1) + '億'
  if (abs >= 1e4) return (n / 1e4).toFixed(abs >= 1e5 ? 0 : 1) + '萬'
  return String(Math.round(n))
}
