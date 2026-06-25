package com.lifedashboard.game.dto;

import java.util.List;

/**
 * One frame of a tumble sequence. {@code grid} is the 6x5 board (row-major,
 * 30 cells, index = row*6 + col, row 0 = top) at this step. {@code winPositions}
 * are the cell indexes that form a winning cluster on this frame (empty on the
 * final settling frame). {@code pay} is the coins won on this frame, before any
 * multiplier orb is applied.
 */
public record SethTumble(List<SethCell> grid, List<Integer> winPositions, long pay) {
}
