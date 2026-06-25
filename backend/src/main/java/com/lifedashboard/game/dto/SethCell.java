package com.lifedashboard.game.dto;

/**
 * One cell on the 6x5 Seth board.
 * type: 0–7 = pay symbols (low→high), 8 = scatter, 9 = multiplier orb.
 * value: the multiplier (e.g. 2,3,5,…,500) when type == 9, otherwise 0.
 */
public record SethCell(int type, int value) {
    public static final int SCATTER = 8;
    public static final int ORB = 9;

    public static SethCell symbol(int type) {
        return new SethCell(type, 0);
    }
}
