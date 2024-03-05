export type SNPConfig = { plot_widgets: PlotWidget[] };

export type PlotWidget = {
  call_code: string;
  arg_name: string;
  type: string;

  flip?: boolean;
};

export function get_config(): SNPConfig {
  return {
    plot_widgets: [
      {
        call_code: "ax.set_title",
        arg_name: "label",
        type: "builtins.str",
      },
      // {
      //   call_code: "ax.set_title",
      //   arg_name: "y",
      //   flip: true,
      //   type: "builtins.float",
      // },
      {
        call_code: "ax.set_xlabel",
        arg_name: "xlabel",
        type: "builtins.str",
      },
      {
        call_code: "ax.set_ylabel",
        arg_name: "ylabel",
        type: "builtins.str",
      },
    ],
  };
}
