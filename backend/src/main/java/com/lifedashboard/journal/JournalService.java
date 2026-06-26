package com.lifedashboard.journal;

import com.lifedashboard.common.exception.ResourceNotFoundException;
import com.lifedashboard.journal.dto.CreateJournalRequest;
import com.lifedashboard.journal.dto.JournalDto;
import com.lifedashboard.journal.dto.UpdateJournalRequest;
import com.lifedashboard.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class JournalService {

    private final JournalRepository journalRepository;
    private final CurrentUserService currentUserService;

    @Transactional(readOnly = true)
    public List<JournalDto> list() {
        Long userId = currentUserService.getCurrentUserId();
        return journalRepository.findByUserIdOrderByEntryDateDescIdDesc(userId).stream()
                .map(JournalDto::from).toList();
    }

    @Transactional
    public JournalDto create(CreateJournalRequest request) {
        Long userId = currentUserService.getCurrentUserId();
        Journal journal = Journal.builder()
                .userId(userId)
                .title(request.title())
                .content(request.content())
                .entryDate(request.entryDate() != null ? request.entryDate() : LocalDate.now())
                .mood(request.mood())
                .build();
        return JournalDto.from(journalRepository.save(journal));
    }

    @Transactional
    public JournalDto update(Long id, UpdateJournalRequest request) {
        Journal journal = getOwned(id);
        if (request.title() != null) journal.setTitle(request.title());
        if (request.content() != null) journal.setContent(request.content());
        if (request.entryDate() != null) journal.setEntryDate(request.entryDate());
        if (request.mood() != null) journal.setMood(request.mood());
        return JournalDto.from(journalRepository.save(journal));
    }

    @Transactional
    public void delete(Long id) {
        journalRepository.delete(getOwned(id));
    }

    private Journal getOwned(Long id) {
        Long userId = currentUserService.getCurrentUserId();
        return journalRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Journal not found: " + id));
    }
}
