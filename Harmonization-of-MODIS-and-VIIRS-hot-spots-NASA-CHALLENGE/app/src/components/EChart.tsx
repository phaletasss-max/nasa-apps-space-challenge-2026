import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as echarts from "echarts/core";
import type { EChartsOption } from "echarts";
import { BarChart, HeatmapChart, LineChart } from "echarts/charts";
import {
  GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, MarkPointComponent, TooltipComponent, VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// Register only what FireCal draws (keeps the bundle ~0.5 MB lighter than `import * from "echarts"`).
echarts.use([BarChart, HeatmapChart, LineChart, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent,
  MarkPointComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);

export interface EChartHandle {
  png: () => string | undefined;
}

interface Props {
  option: EChartsOption;
  height: number;
  onClick?: (p: echarts.ECElementEvent) => void;
  ariaLabel: string;
}

const EChart = forwardRef<EChartHandle, Props>(function EChart({ option, height, onClick, ariaLabel }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    const c = echarts.init(el.current!, undefined, { renderer: "canvas" });
    chart.current = c;
    c.on("click", (p) => clickRef.current?.(p as echarts.ECElementEvent));
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current!);
    return () => { ro.disconnect(); c.dispose(); };
  }, []);

  useEffect(() => { chart.current?.setOption(option, true); }, [option]);

  useImperativeHandle(ref, () => ({
    png: () => chart.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#121519" }),
  }));

  return <div ref={el} style={{ height, width: "100%" }} role="img" aria-label={ariaLabel} />;
});

export default EChart;

export const AXIS = {
  axisLine: { lineStyle: { color: "#2a2f38" } },
  axisLabel: { color: "#9aa0a8", fontSize: 11 },
  splitLine: { lineStyle: { color: "#22262d" } },
};

export const TOOLTIP = {
  backgroundColor: "#1c2027", borderColor: "#2f3540", textStyle: { color: "#e8e6e3", fontSize: 12 },
};
