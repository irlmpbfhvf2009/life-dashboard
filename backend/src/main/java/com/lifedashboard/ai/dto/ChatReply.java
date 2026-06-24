package com.lifedashboard.ai.dto;

/**
 * The coach's structured answer. {@code reply} is the conversational response in
 * English; {@code correction} is a short note on grammar/word-choice, or null/
 * blank when the learner's English was already fine.
 */
public record ChatReply(String reply, String correction) {
}
