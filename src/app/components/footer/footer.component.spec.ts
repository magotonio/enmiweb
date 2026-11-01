import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FooterComponent } from './footer.component';
import { version } from '../../../../package.json';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the footer component', () => {
    expect(component).toBeTruthy();
  });

  it('should display current year', () => {
    expect(component.currentYear).toEqual(new Date().getFullYear());
  });

  it('should display the version from package.json', () => {
    const footer: HTMLElement = fixture.nativeElement;
    const versionLabel = footer.querySelector('[data-testid="app-version"]');

    expect(versionLabel?.textContent?.trim()).toBe(`Versi\u00f3n ${version}`);
  });
});
