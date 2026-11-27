/**
 * Strings that were only written in English and fell back to English in every
 * other language (report dialog, feedback button, admin notifications, household
 * leave note, back-to-top). Merged last so they win over any partial module.
 */

type Gap = { ui?: Record<string, string>; s?: Record<string, string> };

const de: Gap = {
  ui: {
    notifAdmin: 'Neue Nutzer & Anmeldungen',
    notifAdminDesc: 'Nur für Admins: Benachrichtigung, wenn sich jemand registriert oder anmeldet.',
  },
  s: {
    xFeedbackSend: 'Feedback senden',
    imageUnavailable: 'Kein lizenzfreies Foto',
    hhLeaveNote:
      'Beim Verlassen werden deine Beiträge aus dem Haushalt gelöscht. Ist niemand mehr drin, wird der Haushalt mit allen Daten entfernt.',
    backToTop: 'Nach oben',
    commReport: 'Melden',
    commReportTitle: 'Beitrag melden',
    commReportHint: 'Sag uns, was an diesem Community-Rezept nicht stimmt.',
    commReportSent: 'Meldung gesendet',
    commReportThanks: 'Danke – wir lesen jede Meldung.',
    commReportPickReason: 'Bitte wähle einen Grund.',
    commReportSpam: 'Spam oder Werbung',
    commReportOffensive: 'Anstößige Inhalte',
    commReportWrong: 'Falsches oder irreführendes Rezept',
    commReportOther: 'Etwas anderes',
    commSave: 'Speichern',
    commSavedShort: 'Gespeichert',
  },
};

const ar: Gap = {
  ui: {
    notifAdmin: 'مستخدمون جدد وتسجيلات دخول',
    notifAdminDesc: 'للمشرفين فقط: إشعار عند إنشاء حساب أو تسجيل الدخول.',
  },
  s: {
    xFeedbackSend: 'إرسال الملاحظات',
    imageUnavailable: 'لا توجد صورة مجانية',
    hhLeaveNote: 'عند المغادرة تُحذف مساهماتك من المنزل. وإن لم يبقَ أحد يُحذف المنزل وكل بياناته.',
    backToTop: 'إلى الأعلى',
    commReport: 'إبلاغ',
    commReportTitle: 'الإبلاغ عن هذا المنشور',
    commReportHint: 'أخبرنا بما الخطأ في وصفة المجتمع هذه.',
    commReportSent: 'تم إرسال البلاغ',
    commReportThanks: 'شكرًا — نقرأ كل بلاغ.',
    commReportPickReason: 'يرجى اختيار سبب.',
    commReportSpam: 'رسائل مزعجة أو إعلانات',
    commReportOffensive: 'محتوى مسيء',
    commReportWrong: 'وصفة خاطئة أو مضللة',
    commReportOther: 'شيء آخر',
    commSave: 'حفظ',
    commSavedShort: 'محفوظ',
  },
};

const fr: Gap = {
  ui: {
    notifAdmin: 'Nouveaux utilisateurs et connexions',
    notifAdminDesc: 'Réservé aux admins : notification quand quelqu’un crée un compte ou se connecte.',
  },
  s: {
    xFeedbackSend: 'Envoyer un avis',
    imageUnavailable: 'Pas de photo libre de droits',
    hhLeaveNote:
      'En partant, vos contributions sont retirées du foyer. S’il ne reste personne, le foyer et toutes ses données sont supprimés.',
    backToTop: 'Retour en haut',
    commReport: 'Signaler',
    commReportTitle: 'Signaler cette publication',
    commReportHint: 'Dites-nous ce qui cloche dans cette recette de la communauté.',
    commReportSent: 'Signalement envoyé',
    commReportThanks: 'Merci — nous lisons chaque signalement.',
    commReportPickReason: 'Choisissez un motif.',
    commReportSpam: 'Spam ou publicité',
    commReportOffensive: 'Contenu offensant',
    commReportWrong: 'Recette erronée ou trompeuse',
    commReportOther: 'Autre chose',
    commSave: 'Enregistrer',
    commSavedShort: 'Enregistré',
  },
};

const es: Gap = {
  ui: {
    notifAdmin: 'Nuevos usuarios e inicios de sesión',
    notifAdminDesc: 'Solo administradores: aviso cuando alguien crea una cuenta o inicia sesión.',
  },
  s: {
    xFeedbackSend: 'Enviar comentarios',
    imageUnavailable: 'Sin foto libre de derechos',
    hhLeaveNote: 'Al salir, tus aportes se eliminan del hogar. Si no queda nadie, se borra el hogar y todos sus datos.',
    backToTop: 'Volver arriba',
    commReport: 'Denunciar',
    commReportTitle: 'Denunciar esta publicación',
    commReportHint: 'Cuéntanos qué falla en esta receta de la comunidad.',
    commReportSent: 'Denuncia enviada',
    commReportThanks: 'Gracias: leemos todas las denuncias.',
    commReportPickReason: 'Elige un motivo.',
    commReportSpam: 'Spam o publicidad',
    commReportOffensive: 'Contenido ofensivo',
    commReportWrong: 'Receta incorrecta o engañosa',
    commReportOther: 'Otra cosa',
    commSave: 'Guardar',
    commSavedShort: 'Guardado',
  },
};

const it: Gap = {
  ui: {
    notifAdmin: 'Nuovi utenti e accessi',
    notifAdminDesc: 'Solo admin: notifica quando qualcuno crea un account o accede.',
  },
  s: {
    xFeedbackSend: 'Invia feedback',
    imageUnavailable: 'Nessuna foto libera',
    hhLeaveNote:
      'Uscendo, i tuoi contributi vengono rimossi dal nucleo. Se non resta nessuno, il nucleo e tutti i suoi dati vengono eliminati.',
    backToTop: 'Torna su',
    commReport: 'Segnala',
    commReportTitle: 'Segnala questo post',
    commReportHint: 'Dicci cosa non va in questa ricetta della community.',
    commReportSent: 'Segnalazione inviata',
    commReportThanks: 'Grazie: leggiamo ogni segnalazione.',
    commReportPickReason: 'Scegli un motivo.',
    commReportSpam: 'Spam o pubblicità',
    commReportOffensive: 'Contenuti offensivi',
    commReportWrong: 'Ricetta errata o fuorviante',
    commReportOther: 'Altro',
    commSave: 'Salva',
    commSavedShort: 'Salvato',
  },
};

const tr: Gap = {
  ui: {
    notifAdmin: 'Yeni kullanıcılar ve girişler',
    notifAdminDesc: 'Yalnızca yöneticiler: biri hesap oluşturduğunda veya giriş yaptığında bildirim.',
  },
  s: {
    xFeedbackSend: 'Geri bildirim gönder',
    imageUnavailable: 'Lisanssız fotoğraf yok',
    hhLeaveNote: 'Ayrıldığında katkıların evden kaldırılır. Kimse kalmazsa ev ve tüm verileri silinir.',
    backToTop: 'Başa dön',
    commReport: 'Bildir',
    commReportTitle: 'Bu gönderiyi bildir',
    commReportHint: 'Bu topluluk tarifinde neyin yanlış olduğunu söyle.',
    commReportSent: 'Bildirim gönderildi',
    commReportThanks: 'Teşekkürler — her bildirimi okuyoruz.',
    commReportPickReason: 'Lütfen bir neden seç.',
    commReportSpam: 'Spam veya reklam',
    commReportOffensive: 'Rahatsız edici içerik',
    commReportWrong: 'Yanlış veya yanıltıcı tarif',
    commReportOther: 'Başka bir şey',
    commSave: 'Kaydet',
    commSavedShort: 'Kaydedildi',
  },
};

const pt: Gap = {
  ui: {
    notifAdmin: 'Novos utilizadores e inícios de sessão',
    notifAdminDesc: 'Só administradores: aviso quando alguém cria conta ou inicia sessão.',
  },
  s: {
    xFeedbackSend: 'Enviar feedback',
    imageUnavailable: 'Sem foto livre de direitos',
    hhLeaveNote:
      'Ao sair, as tuas contribuições são removidas da casa. Se não ficar ninguém, a casa e todos os dados são apagados.',
    backToTop: 'Voltar ao topo',
    commReport: 'Denunciar',
    commReportTitle: 'Denunciar esta publicação',
    commReportHint: 'Diz-nos o que está errado nesta receita da comunidade.',
    commReportSent: 'Denúncia enviada',
    commReportThanks: 'Obrigado — lemos todas as denúncias.',
    commReportPickReason: 'Escolhe um motivo.',
    commReportSpam: 'Spam ou publicidade',
    commReportOffensive: 'Conteúdo ofensivo',
    commReportWrong: 'Receita errada ou enganadora',
    commReportOther: 'Outra coisa',
    commSave: 'Guardar',
    commSavedShort: 'Guardado',
  },
};

const nl: Gap = {
  ui: {
    notifAdmin: 'Nieuwe gebruikers en aanmeldingen',
    notifAdminDesc: 'Alleen beheerders: melding wanneer iemand een account maakt of inlogt.',
  },
  s: {
    xFeedbackSend: 'Feedback sturen',
    imageUnavailable: 'Geen rechtenvrije foto',
    hhLeaveNote:
      'Als je vertrekt, worden je bijdragen uit het huishouden verwijderd. Is er niemand meer, dan worden het huishouden en alle gegevens verwijderd.',
    backToTop: 'Naar boven',
    commReport: 'Melden',
    commReportTitle: 'Dit bericht melden',
    commReportHint: 'Vertel ons wat er mis is met dit communityrecept.',
    commReportSent: 'Melding verzonden',
    commReportThanks: 'Bedankt — we lezen elke melding.',
    commReportPickReason: 'Kies een reden.',
    commReportSpam: 'Spam of advertenties',
    commReportOffensive: 'Aanstootgevende inhoud',
    commReportWrong: 'Onjuist of misleidend recept',
    commReportOther: 'Iets anders',
    commSave: 'Opslaan',
    commSavedShort: 'Opgeslagen',
  },
};

const ru: Gap = {
  ui: {
    notifAdmin: 'Новые пользователи и входы',
    notifAdminDesc: 'Только для админов: уведомление, когда кто-то создаёт аккаунт или входит.',
  },
  s: {
    xFeedbackSend: 'Отправить отзыв',
    imageUnavailable: 'Нет свободного фото',
    hhLeaveNote: 'При выходе ваши записи удаляются из дома. Если никого не останется, дом и все его данные удаляются.',
    backToTop: 'Наверх',
    commReport: 'Пожаловаться',
    commReportTitle: 'Пожаловаться на запись',
    commReportHint: 'Расскажите, что не так с этим рецептом сообщества.',
    commReportSent: 'Жалоба отправлена',
    commReportThanks: 'Спасибо — мы читаем каждую жалобу.',
    commReportPickReason: 'Выберите причину.',
    commReportSpam: 'Спам или реклама',
    commReportOffensive: 'Оскорбительный контент',
    commReportWrong: 'Неверный или вводящий в заблуждение рецепт',
    commReportOther: 'Другое',
    commSave: 'Сохранить',
    commSavedShort: 'Сохранено',
  },
};

const uk: Gap = {
  ui: {
    notifAdmin: 'Нові користувачі та входи',
    notifAdminDesc: 'Лише для адмінів: сповіщення, коли хтось створює акаунт або входить.',
  },
  s: {
    xFeedbackSend: 'Надіслати відгук',
    imageUnavailable: 'Немає вільного фото',
    hhLeaveNote: 'Після виходу ваші записи видаляються з дому. Якщо нікого не залишиться, дім і всі його дані видаляються.',
    backToTop: 'Догори',
    commReport: 'Поскаржитися',
    commReportTitle: 'Поскаржитися на допис',
    commReportHint: 'Розкажіть, що не так із цим рецептом спільноти.',
    commReportSent: 'Скаргу надіслано',
    commReportThanks: 'Дякуємо — ми читаємо кожну скаргу.',
    commReportPickReason: 'Виберіть причину.',
    commReportSpam: 'Спам або реклама',
    commReportOffensive: 'Образливий вміст',
    commReportWrong: 'Неправильний або оманливий рецепт',
    commReportOther: 'Інше',
    commSave: 'Зберегти',
    commSavedShort: 'Збережено',
  },
};

const zh: Gap = {
  ui: {
    notifAdmin: '新用户与登录',
    notifAdminDesc: '仅管理员：有人注册或登录时通知你。',
  },
  s: {
    xFeedbackSend: '发送反馈',
    imageUnavailable: '没有免费授权照片',
    hhLeaveNote: '退出后你的内容会从家庭中移除。如果没有人留下，家庭及其所有数据都会被删除。',
    backToTop: '回到顶部',
    commReport: '举报',
    commReportTitle: '举报这条内容',
    commReportHint: '告诉我们这道社区食谱哪里有问题。',
    commReportSent: '举报已发送',
    commReportThanks: '谢谢——我们会阅读每一条举报。',
    commReportPickReason: '请选择原因。',
    commReportSpam: '垃圾信息或广告',
    commReportOffensive: '冒犯性内容',
    commReportWrong: '错误或误导性食谱',
    commReportOther: '其他',
    commSave: '保存',
    commSavedShort: '已保存',
  },
};

const ja: Gap = {
  ui: {
    notifAdmin: '新規ユーザーとログイン',
    notifAdminDesc: '管理者のみ：誰かが登録またはログインしたときに通知します。',
  },
  s: {
    xFeedbackSend: 'フィードバックを送る',
    imageUnavailable: 'フリー素材の写真がありません',
    hhLeaveNote: '退出するとあなたの投稿は世帯から削除されます。誰も残らない場合、世帯とすべてのデータが削除されます。',
    backToTop: '上へ戻る',
    commReport: '報告',
    commReportTitle: 'この投稿を報告',
    commReportHint: 'このコミュニティレシピの問題点を教えてください。',
    commReportSent: '報告を送信しました',
    commReportThanks: 'ありがとうございます。すべての報告を読んでいます。',
    commReportPickReason: '理由を選んでください。',
    commReportSpam: 'スパムまたは広告',
    commReportOffensive: '不快なコンテンツ',
    commReportWrong: '誤った、または誤解を招くレシピ',
    commReportOther: 'その他',
    commSave: '保存',
    commSavedShort: '保存済み',
  },
};

const ko: Gap = {
  ui: {
    notifAdmin: '새 사용자 및 로그인',
    notifAdminDesc: '관리자 전용: 누군가 가입하거나 로그인하면 알림을 받습니다.',
  },
  s: {
    xFeedbackSend: '피드백 보내기',
    imageUnavailable: '무료 라이선스 사진 없음',
    hhLeaveNote: '나가면 내 기여가 가구에서 삭제됩니다. 아무도 남지 않으면 가구와 모든 데이터가 삭제됩니다.',
    backToTop: '맨 위로',
    commReport: '신고',
    commReportTitle: '이 게시물 신고',
    commReportHint: '이 커뮤니티 레시피의 문제를 알려 주세요.',
    commReportSent: '신고가 전송되었습니다',
    commReportThanks: '감사합니다. 모든 신고를 읽습니다.',
    commReportPickReason: '이유를 선택하세요.',
    commReportSpam: '스팸 또는 광고',
    commReportOffensive: '불쾌한 콘텐츠',
    commReportWrong: '잘못되었거나 오해의 소지가 있는 레시피',
    commReportOther: '기타',
    commSave: '저장',
    commSavedShort: '저장됨',
  },
};

const hi: Gap = {
  ui: {
    notifAdmin: 'नए उपयोगकर्ता और साइन-इन',
    notifAdminDesc: 'केवल एडमिन: जब कोई खाता बनाए या साइन इन करे तो सूचना।',
  },
  s: {
    xFeedbackSend: 'फ़ीडबैक भेजें',
    imageUnavailable: 'कोई मुफ़्त फ़ोटो नहीं',
    hhLeaveNote: 'छोड़ने पर आपके योगदान घर से हट जाते हैं। अगर कोई न बचे तो घर और उसका सारा डेटा हटा दिया जाता है।',
    backToTop: 'ऊपर जाएँ',
    commReport: 'रिपोर्ट करें',
    commReportTitle: 'यह पोस्ट रिपोर्ट करें',
    commReportHint: 'बताइए इस कम्युनिटी रेसिपी में क्या गलत है।',
    commReportSent: 'रिपोर्ट भेज दी गई',
    commReportThanks: 'धन्यवाद — हम हर रिपोर्ट पढ़ते हैं।',
    commReportPickReason: 'कृपया कारण चुनें।',
    commReportSpam: 'स्पैम या विज्ञापन',
    commReportOffensive: 'आपत्तिजनक सामग्री',
    commReportWrong: 'गलत या भ्रामक रेसिपी',
    commReportOther: 'कुछ और',
    commSave: 'सहेजें',
    commSavedShort: 'सहेजा गया',
  },
};

const pl: Gap = {
  ui: {
    notifAdmin: 'Nowi użytkownicy i logowania',
    notifAdminDesc: 'Tylko administratorzy: powiadomienie, gdy ktoś utworzy konto lub się zaloguje.',
  },
  s: {
    xFeedbackSend: 'Wyślij opinię',
    imageUnavailable: 'Brak darmowego zdjęcia',
    hhLeaveNote:
      'Po wyjściu Twoje wpisy są usuwane z gospodarstwa. Jeśli nikt nie zostanie, gospodarstwo i wszystkie dane zostaną usunięte.',
    backToTop: 'Do góry',
    commReport: 'Zgłoś',
    commReportTitle: 'Zgłoś ten post',
    commReportHint: 'Powiedz nam, co jest nie tak w tym przepisie społeczności.',
    commReportSent: 'Zgłoszenie wysłane',
    commReportThanks: 'Dziękujemy — czytamy każde zgłoszenie.',
    commReportPickReason: 'Wybierz powód.',
    commReportSpam: 'Spam lub reklama',
    commReportOffensive: 'Obraźliwe treści',
    commReportWrong: 'Błędny lub wprowadzający w błąd przepis',
    commReportOther: 'Coś innego',
    commSave: 'Zapisz',
    commSavedShort: 'Zapisano',
  },
};

export const I18N_GAPS: Record<string, Gap> = { de, ar, fr, es, it, tr, pt, nl, ru, uk, zh, ja, ko, hi, pl };
